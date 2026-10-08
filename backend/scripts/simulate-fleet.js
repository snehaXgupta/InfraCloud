/**
 * Fleet simulator — exercises the platform without real servers.
 *
 * For every server in the inventory it behaves like an installed host:
 *   • pushes node_exporter-style metrics through POST /ingest/metrics (vmagent's job)
 *   • sends heartbeats to POST /api/agent/heartbeat (infra-agent's job)
 * Both use a per-server agent token, exactly like a real host, so auth, the server_id
 * rewrite, Prometheus charts, status changes, alerts, emails and heartbeat loss all run for real.
 *
 * Usage:
 *   npm run simulate                                  # whole fleet, healthy
 *   npm run simulate -- --scenario cpu=Payment        # CPU stuck at ~97% on servers matching "Payment"
 *   npm run simulate -- --scenario disk=Replica --scenario offline=Worker
 *
 * Scenarios: cpu (CPU ~97%), memory (memory leak climbing to ~98%), disk (disk filling to ~93%),
 *            offline (host stops reporting → heartbeat alert after the grace period), ok (reset).
 * While running, type a scenario on stdin, e.g. `cpu Payment`, `ok Payment`, `list`.
 *
 * Servers that already receive metrics from a real agent are skipped (use --include-real to override).
 * For quick alert demos start the API with ALERT_DURATION_SCALE=0.05 (10-minute rules fire after 30 s).
 *
 * Env: MONGO_URI (to mint simulator tokens), API_URL (default http://127.0.0.1:5000),
 *      PROM_URL (default http://127.0.0.1:9090), SIM_INTERVAL_SECONDS (default 15)
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const crypto = require('crypto');
const readline = require('readline');
const mongoose = require('mongoose');
const Server = require('../src/models/Server');
const AgentCredential = require('../src/models/AgentCredential');
const { encodeSeries, buildWriteRequest } = require('./lib/remoteWriteEncode');

const API_URL = (process.env.API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const PROM_URL = (process.env.PROM_URL || 'http://127.0.0.1:9090').replace(/\/$/, '');
const INTERVAL = Number(process.env.SIM_INTERVAL_SECONDS || 15);
const SIM_TOKEN_PREFIX = 'simulator';
const SCENARIOS = ['cpu', 'memory', 'disk', 'offline', 'ok'];
const MAX_NET_BYTES_PER_SEC = 50e6; // simulated traffic stays far below this

const args = process.argv.slice(2);
const includeReal = args.includes('--include-real');
const initialScenarios = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scenario' && args[i + 1]) initialScenarios.push(args[++i]);
}

// Deterministic per-server baseline so each host looks different but stable across restarts
const seeded = (id, salt, min, max) => {
  const h = crypto.createHash('md5').update(`${id}:${salt}`).digest().readUInt32BE(0) / 0xffffffff;
  return min + h * (max - min);
};
const jitter = (amp) => (Math.random() - 0.5) * 2 * amp;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const createHost = (server, token) => {
  const id = server._id.toString();
  const cores = server.compute?.vcpu || 2;
  const memBytes = (server.compute?.ramGb || 8) * 2 ** 30;
  const diskBytes = (server.storage?.diskTotalGb || 100) * 2 ** 30;
  return {
    id,
    name: server.name,
    token,
    cores,
    memBytes,
    diskBytes,
    base: {
      cpu: seeded(id, 'cpu', 8, 45),
      memory: seeded(id, 'mem', 30, 65),
      disk: seeded(id, 'disk', 25, 60),
      rxMbps: seeded(id, 'rx', 5, 60),
      txMbps: seeded(id, 'tx', 5, 90),
    },
    scenario: 'ok',
    scenarioStartedAt: Date.now(),
    bootTime: Date.now() / 1000 - seeded(id, 'uptime', 2, 60) * 86400,
    // Counters must never go backwards across simulator restarts, or Prometheus sees a counter
    // reset and computes huge rates. Each counter grows by at most its per-second bound, so
    // starting at (seconds since epoch × bound) is always ≥ wherever a previous run stopped.
    counters: (() => {
      const t = Date.now() / 1000;
      return { idle: t, busy: t, rx: t * MAX_NET_BYTES_PER_SEC, tx: t * MAX_NET_BYTES_PER_SEC };
    })(),
    current: {},
  };
};

const sample = (host) => {
  const minutesIn = (Date.now() - host.scenarioStartedAt) / 60000;
  let cpu = host.base.cpu + jitter(6);
  let memory = host.base.memory + jitter(1.5);
  let disk = host.base.disk;

  if (host.scenario === 'cpu') cpu = 97 + jitter(1.5);
  if (host.scenario === 'memory') memory = Math.min(98, host.base.memory + minutesIn * 15);
  if (host.scenario === 'disk') disk = Math.min(93, host.base.disk + minutesIn * 20);

  return {
    cpu: clamp(cpu, 0.5, 99.5),
    memory: clamp(memory, 1, 99.5),
    disk: clamp(disk, 1, 99.5),
    rxMbps: Math.max(0.1, host.base.rxMbps + jitter(host.base.rxMbps * 0.3)),
    txMbps: Math.max(0.1, host.base.txMbps + jitter(host.base.txMbps * 0.3)),
  };
};

const pushMetrics = async (host, s, now) => {
  const step = INTERVAL;
  // One aggregate CPU series: per-CPU idle rate must stay within 0..1 for the platform's PromQL
  host.counters.idle += (step * (100 - s.cpu)) / 100;
  host.counters.busy += (step * s.cpu) / 100;
  host.counters.rx += (s.rxMbps * 1e6 * step) / 8;
  host.counters.tx += (s.txMbps * 1e6 * step) / 8;

  // job="simulator" lets the platform (and you) tell simulated hosts from real ones
  const base = { job: 'simulator', instance: `${host.name.replace(/\W+/g, '-').toLowerCase()}:9100` };
  const g = (name, value, extra = {}) => encodeSeries({ ...base, ...extra, __name__: name }, [[value, now]]);
  const fs = { mountpoint: '/', fstype: 'ext4', device: '/dev/vda1' };
  const load = (s.cpu / 100) * host.cores;

  const body = buildWriteRequest([
    g('node_cpu_seconds_total', host.counters.idle, { cpu: '0', mode: 'idle' }),
    g('node_cpu_seconds_total', host.counters.busy, { cpu: '0', mode: 'user' }),
    g('node_memory_MemTotal_bytes', host.memBytes),
    g('node_memory_MemAvailable_bytes', host.memBytes * (1 - s.memory / 100)),
    g('node_filesystem_size_bytes', host.diskBytes, fs),
    g('node_filesystem_avail_bytes', host.diskBytes * (1 - s.disk / 100), fs),
    g('node_network_receive_bytes_total', host.counters.rx, { device: 'eth0' }),
    g('node_network_transmit_bytes_total', host.counters.tx, { device: 'eth0' }),
    g('node_load1', load),
    g('node_load5', load * 0.9),
    g('node_load15', load * 0.8),
    g('node_boot_time_seconds', host.bootTime),
  ]);

  const res = await fetch(`${API_URL}/ingest/metrics`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${host.token}`, 'Content-Type': 'application/x-protobuf', 'Content-Encoding': 'snappy' },
    body,
  });
  if (![200, 204].includes(res.status)) throw new Error(`ingest HTTP ${res.status} ${await res.text()}`);
};

const sendHeartbeat = async (host, s) => {
  const res = await fetch(`${API_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${host.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cpuUsage: s.cpu,
      memoryUsage: s.memory,
      diskUsage: s.disk,
      memoryTotalMb: host.memBytes / 2 ** 20,
      diskTotalGb: host.diskBytes / 2 ** 30,
      diskUsedGb: Math.round(((host.diskBytes / 2 ** 30) * s.disk) / 100),
      loadAvg: [(s.cpu / 100) * host.cores, 0, 0].map((v) => Math.round(v * 100) / 100),
      uptimeSeconds: Math.round(Date.now() / 1000 - host.bootTime),
      osKernel: 'Linux 6.8.0-simulated (x86_64)',
      agentVersion: 'v2.5.0-simulator',
    }),
  });
  if (!res.ok) throw new Error(`heartbeat HTTP ${res.status}`);
  return (await res.json()).serverStatus;
};

const realAgentServers = async () => {
  try {
    const q = encodeURIComponent('count by (server_id) (node_boot_time_seconds{job!="simulator"})');
    const body = await (await fetch(`${PROM_URL}/api/v1/query?query=${q}`)).json();
    return new Set(body.data.result.map((r) => r.metric.server_id));
  } catch {
    return new Set();
  }
};

const applyScenario = (hosts, spec) => {
  const [scenario, ...rest] = spec.split(/[=\s]+/);
  const match = rest.join(' ').toLowerCase();
  if (!SCENARIOS.includes(scenario) || !match) {
    console.log(`  usage: <${SCENARIOS.join('|')}> <server name or id fragment>`);
    return;
  }
  const targets = hosts.filter((h) => h.name.toLowerCase().includes(match) || h.id.includes(match));
  if (!targets.length) return console.log(`  no simulated server matches "${match}"`);
  for (const h of targets) {
    h.scenario = scenario;
    h.scenarioStartedAt = Date.now();
    console.log(`  → ${h.name}: ${scenario}`);
  }
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform');
  const real = includeReal ? new Set() : await realAgentServers();
  const servers = await Server.find().sort({ name: 1 });

  // Mint one simulator token per server directly in the DB. Unlike the API endpoint this does
  // not revoke a real host's token; old simulator tokens are revoked first.
  await AgentCredential.updateMany({ tokenPrefix: SIM_TOKEN_PREFIX, revokedAt: null }, { revokedAt: new Date() });
  const hosts = [];
  for (const server of servers) {
    if (real.has(server._id.toString())) {
      console.log(`skip  ${server.name} (real agent reporting)`);
      continue;
    }
    const token = `sma_${crypto.randomBytes(32).toString('base64url')}`;
    await AgentCredential.create({ serverId: server._id, tokenHash: AgentCredential.hashToken(token), tokenPrefix: SIM_TOKEN_PREFIX });
    hosts.push(createHost(server, token));
  }
  await mongoose.disconnect();

  initialScenarios.forEach((spec) => applyScenario(hosts, spec));
  console.log(`\nSimulating ${hosts.length} servers every ${INTERVAL}s → ${API_URL}. Ctrl+C to stop.\n`);

  const tick = async () => {
    const now = Date.now();
    const lines = await Promise.all(
      hosts.map(async (h) => {
        if (h.scenario === 'offline') return `${h.name.padEnd(36)} offline (not reporting)`;
        const s = sample(h);
        try {
          await pushMetrics(h, s, now);
          const status = await sendHeartbeat(h, s);
          return `${h.name.padEnd(36)} cpu ${s.cpu.toFixed(0).padStart(3)}%  mem ${s.memory.toFixed(0).padStart(3)}%  disk ${s.disk.toFixed(0).padStart(3)}%  → ${status}${h.scenario !== 'ok' ? `  [${h.scenario}]` : ''}`;
        } catch (err) {
          return `${h.name.padEnd(36)} ERROR ${err.message}`;
        }
      })
    );
    console.log(`[${new Date().toLocaleTimeString()}]\n  ${lines.join('\n  ')}`);
  };

  await tick();
  setInterval(tick, INTERVAL * 1000);

  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const cmd = line.trim();
      if (!cmd) return;
      if (cmd === 'list') return hosts.forEach((h) => console.log(`  ${h.name} [${h.scenario}]`));
      applyScenario(hosts, cmd);
    });
  }
})().catch((err) => {
  console.error('simulator failed:', err.message);
  process.exit(1);
});
