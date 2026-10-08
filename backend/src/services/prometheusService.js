/**
 * Prometheus Query Service
 * Reads host telemetry (node_exporter metrics pushed via the ingest gateway) for a server.
 * Prometheus stays private; only the API talks to it, after auth/scope checks.
 */

const PROM_URL = (process.env.PROM_URL || 'http://127.0.0.1:9090').replace(/\/$/, '');
const QUERY_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5000;
const STALE_AFTER_SECONDS = 60;

// [window seconds, step seconds]
const RANGES = {
  '5m': [300, 15],
  '15m': [900, 15],
  '1h': [3600, 60],
  '6h': [21600, 300],
  '24h': [86400, 900],
  '7d': [604800, 3600],
  '30d': [2592000, 14400],
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const NET_DEVICES = 'device!~"lo|veth.*|docker.*|br-.*|cni.*|flannel.*"';
const ROOT_FS = 'mountpoint="/",fstype!~"tmpfs|overlay|squashfs"';

// rateWindow must cover at least a few 15s scrape intervals
const expressions = (id, rateWindow) => {
  const sel = `server_id="${id}"`;
  return {
    // clamp(): a counter glitch (e.g. an agent restarting with a higher counter) must never
    // produce impossible values like -60000% or 400%
    cpu: `clamp(100 * (1 - avg(rate(node_cpu_seconds_total{${sel},mode="idle"}[${rateWindow}s]))), 0, 100)`,
    memory: `max(100 * (1 - node_memory_MemAvailable_bytes{${sel}} / node_memory_MemTotal_bytes{${sel}}))`,
    disk: `max(100 * (1 - node_filesystem_avail_bytes{${sel},${ROOT_FS}} / node_filesystem_size_bytes{${sel},${ROOT_FS}}))`,
    networkIn: `clamp_min(sum(rate(node_network_receive_bytes_total{${sel},${NET_DEVICES}}[${rateWindow}s])) * 8 / 1e6, 0)`,
    networkOut: `clamp_min(sum(rate(node_network_transmit_bytes_total{${sel},${NET_DEVICES}}[${rateWindow}s])) * 8 / 1e6, 0)`,
    load1: `max(node_load1{${sel}})`,
    load5: `max(node_load5{${sel}})`,
    load15: `max(node_load15{${sel}})`,
  };
};

const promGet = async (path, params) => {
  const url = `${PROM_URL}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) });
  const body = await res.json();
  if (body.status !== 'success') {
    throw new Error(`Prometheus ${path} failed: ${body.error || res.status}`);
  }
  return body.data.result;
};

const instant = async (query) => {
  const result = await promGet('/api/v1/query', { query });
  return result.length ? Number(result[0].value[1]) : null;
};

const round = (v, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

const formatLabel = (date, timeRange) => {
  if (['7d', '30d'].includes(timeRange)) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: ['5m', '15m'].includes(timeRange) ? '2-digit' : undefined,
  });
};

const cache = new Map();

/**
 * @returns {Promise<{hasData, lastSampleAt, isStale, current, series}>}
 */
const getServerMetrics = async (serverId, timeRange = '1h') => {
  const id = String(serverId);
  if (!OBJECT_ID.test(id)) throw new Error('Invalid server id');
  const range = RANGES[timeRange] ? timeRange : '1h';

  const cacheKey = `${id}:${range}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const [windowSeconds, step] = RANGES[range];
  const end = Math.floor(Date.now() / 1000 / step) * step;
  const start = end - windowSeconds;
  const rangeExprs = expressions(id, Math.max(step, 60));
  const currentExprs = expressions(id, 60);

  const [lastSampleTs, uptimeSeconds, ...rest] = await Promise.all([
    instant(`max(timestamp(node_boot_time_seconds{server_id="${id}"}))`),
    instant(`max(time() - node_boot_time_seconds{server_id="${id}"})`),
    ...Object.values(currentExprs).map(instant),
    ...Object.values(rangeExprs).map((query) =>
      promGet('/api/v1/query_range', { query, start, end, step }).then((r) => (r[0] ? r[0].values : []))
    ),
  ]);

  const keys = Object.keys(rangeExprs);
  const currentValues = rest.slice(0, keys.length);
  const rangeValues = rest.slice(keys.length);

  const current = Object.fromEntries(keys.map((k, i) => [k, round(currentValues[i], k.startsWith('load') ? 2 : 1)]));
  current.uptimeDays = round(uptimeSeconds != null ? uptimeSeconds / 86400 : null);

  // Merge per-metric series into rows keyed by timestamp; missing points stay null so charts show gaps.
  const rows = new Map();
  for (let t = start; t <= end; t += step) {
    const date = new Date(t * 1000);
    rows.set(t, { timestamp: date.toISOString(), label: formatLabel(date, range) });
  }
  keys.forEach((key, i) => {
    for (const [t, v] of rangeValues[i]) {
      const row = rows.get(Number(t));
      if (row) row[key] = round(Number(v), key.startsWith('load') ? 2 : 1);
    }
  });
  const series = [...rows.values()].map((row) => {
    for (const key of keys) if (!(key in row)) row[key] = null;
    return row;
  });

  const lastSampleAt = lastSampleTs ? new Date(lastSampleTs * 1000) : null;
  const value = {
    hasData: lastSampleAt !== null || series.some((r) => r.cpu !== null),
    lastSampleAt,
    isStale: !lastSampleAt || Date.now() / 1000 - lastSampleTs > STALE_AFTER_SECONDS,
    current,
    series,
  };

  if (cache.size > 1000) {
    for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_TTL_MS) cache.delete(k);
  }
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
};

/**
 * Average and 95th-percentile CPU / memory over the last `days` (for resize planning).
 * @returns {Promise<{avgCpu,p95Cpu,avgMemory,p95Memory,days}|null>} null when there is no data
 */
const getUtilization = async (serverId, days = 7) => {
  const id = String(serverId);
  if (!OBJECT_ID.test(id)) throw new Error('Invalid server id');
  const e = expressions(id, 60);
  const win = `[${days}d:5m]`;
  const [avgCpu, p95Cpu, avgMemory, p95Memory] = await Promise.all([
    instant(`avg_over_time((${e.cpu})${win})`),
    instant(`quantile_over_time(0.95, (${e.cpu})${win})`),
    instant(`avg_over_time((${e.memory})${win})`),
    instant(`quantile_over_time(0.95, (${e.memory})${win})`),
  ]);
  if (avgCpu == null && avgMemory == null) return null;
  return { avgCpu: round(avgCpu), p95Cpu: round(p95Cpu), avgMemory: round(avgMemory), p95Memory: round(p95Memory), days };
};

const isPrometheusUp = async () => {
  try {
    const res = await fetch(`${PROM_URL}/-/ready`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};

module.exports = { getServerMetrics, getUtilization, isPrometheusUp, PROM_URL, RANGES };
