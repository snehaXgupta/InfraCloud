/**
 * End-to-end check of the metrics pipeline:
 *   issue agent token → remote_write via /ingest/metrics → Prometheus → GET /api/servers/:id/metrics
 *
 * Pushes 10 minutes of synthetic node_exporter series carrying a SPOOFED server_id and verifies
 * the gateway rewrote it to the token's server.
 *
 * Usage: node scripts/test-metrics-pipeline.js   (creates and deletes its own temporary server)
 * Env:   API_URL (default http://127.0.0.1:5000), PROM_URL (default http://127.0.0.1:9090),
 *        TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (default: seeded dev admin from README)
 */

const snappy = require('snappyjs');
const { _internal: pb } = require('../src/services/remoteWrite');

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000';
const PROM_URL = process.env.PROM_URL || 'http://127.0.0.1:9090';
const SPOOFED_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const encodeSample = (value, tsMs) => {
  const dbl = Buffer.alloc(8);
  dbl.writeDoubleLE(value);
  return pb.lengthDelimited(2, Buffer.concat([Buffer.from([0x09]), dbl, Buffer.from([0x10]), pb.encodeVarint(tsMs)]));
};

const encodeSeries = (labels, samples) => {
  const sorted = Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : 1));
  const payload = Buffer.concat([
    ...sorted.map(([name, value]) => pb.encodeLabel({ name, value })),
    ...samples.map(([v, t]) => encodeSample(v, t)),
  ]);
  return pb.lengthDelimited(1, payload);
};

// Prometheus rejects samples older than the newest one already stored for a series,
// so on re-runs only send timestamps after the last stored sample.
const buildPayload = (afterMs = 0) => {
  const base = { job: 'node', instance: '127.0.0.1:9100', server_id: SPOOFED_ID };
  const now = Math.floor(Date.now() / 15000) * 15000;
  const times = Array.from({ length: 40 }, (_, i) => now - (39 - i) * 15000).filter((t) => t > afterMs);
  if (!times.length) times.push(now + 1);
  const counter = (perStep) => times.map((t, i) => [1e6 + i * perStep, t]);
  const gauge = (fn) => times.map((t, i) => [fn(i), t]);

  const series = [
    // 2 CPUs, ~30% busy
    ...['0', '1'].flatMap((cpu) => [
      encodeSeries({ ...base, __name__: 'node_cpu_seconds_total', cpu, mode: 'idle' }, counter(15 * 0.7)),
      encodeSeries({ ...base, __name__: 'node_cpu_seconds_total', cpu, mode: 'user' }, counter(15 * 0.3)),
    ]),
    encodeSeries({ ...base, __name__: 'node_memory_MemTotal_bytes' }, gauge(() => 4 * 2 ** 30)),
    encodeSeries({ ...base, __name__: 'node_memory_MemAvailable_bytes' }, gauge((i) => (1.6 - i * 0.005) * 2 ** 30)),
    encodeSeries({ ...base, __name__: 'node_filesystem_size_bytes', mountpoint: '/', fstype: 'ext4', device: '/dev/vda1' }, gauge(() => 80 * 2 ** 30)),
    encodeSeries({ ...base, __name__: 'node_filesystem_avail_bytes', mountpoint: '/', fstype: 'ext4', device: '/dev/vda1' }, gauge(() => 44 * 2 ** 30)),
    encodeSeries({ ...base, __name__: 'node_network_receive_bytes_total', device: 'eth0' }, counter(15 * 1.5e6)),
    encodeSeries({ ...base, __name__: 'node_network_transmit_bytes_total', device: 'eth0' }, counter(15 * 3e6)),
    encodeSeries({ ...base, __name__: 'node_load1' }, gauge((i) => 0.4 + (i % 5) * 0.05)),
    encodeSeries({ ...base, __name__: 'node_load5' }, gauge(() => 0.45)),
    encodeSeries({ ...base, __name__: 'node_load15' }, gauge(() => 0.5)),
    encodeSeries({ ...base, __name__: 'node_boot_time_seconds' }, gauge(() => now / 1000 - 3 * 86400)),
  ];
  return Buffer.from(snappy.compress(Buffer.concat(series)));
};

const promCount = async (id) => {
  const q = encodeURIComponent(`count({__name__=~"node_.+",server_id="${id}"})`);
  const body = await (await fetch(`${PROM_URL}/api/v1/query?query=${q}`)).json();
  return Number(body.data.result[0]?.value[1] || 0);
};

const lastStoredMs = async (id) => {
  const q = encodeURIComponent(`max(timestamp(node_boot_time_seconds{server_id="${id}"}))`);
  const body = await (await fetch(`${PROM_URL}/api/v1/query?query=${q}`)).json();
  return Math.ceil(Number(body.data.result[0]?.value[1] || 0) * 1000);
};

const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
};

(async () => {
  const login = await (await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
    }),
  })).json();
  const jwt = login.token || login.data?.token;
  if (!jwt) throw new Error(`Login failed: ${JSON.stringify(login)}`);
  const authHeaders = { Authorization: `Bearer ${jwt}` };

  // A throwaway server: issuing a token revokes the server's previous one, so never test on a
  // server a real agent (or the simulator) is using. It is deleted again at the end.
  const list = await (await fetch(`${API_URL}/api/servers`, { headers: authHeaders })).json();
  const template = (list.data || [])[0];
  if (!template) throw new Error('No server found to copy client/project/environment from');
  const idOf = (v) => v?._id || v;
  const created = await (
    await fetch(`${API_URL}/api/servers`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `metrics-test-${Date.now()}`,
        hostname: 'metrics-test.local',
        clientId: idOf(template.clientId),
        projectId: idOf(template.projectId),
        environmentId: idOf(template.environmentId),
        provider: 'On-Premise',
      }),
    })
  ).json();
  const serverId = created.data?._id;
  if (!serverId) throw new Error(`Could not create the temporary server: ${created.error || JSON.stringify(created)}`);
  console.log(`Temporary server under test: ${serverId}\n`);

  const tokenRes = await (await fetch(`${API_URL}/api/servers/${serverId}/agent-token`, { method: 'POST', headers: authHeaders })).json();
  const agentToken = tokenRes.data?.token;
  check('issue agent token', !!agentToken, tokenRes.error);

  const afterMs = await lastStoredMs(serverId);
  const push = (token) =>
    fetch(`${API_URL}/ingest/metrics`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-protobuf', 'Content-Encoding': 'snappy' },
      body: buildPayload(afterMs),
    });

  check('reject bad token', (await push('sma_invalid')).status === 401);

  const res = await push(agentToken);
  check('accept valid push', res.status === 204 || res.status === 200, `HTTP ${res.status} ${await res.text()}`);

  check('spoofed server_id was NOT stored', (await promCount(SPOOFED_ID)) === 0);
  const stored = await promCount(serverId);
  check('series stored under token server_id', stored > 0, `${stored} series`);

  const metrics = await (await fetch(`${API_URL}/api/servers/${serverId}/metrics?timeRange=15m`, { headers: authHeaders })).json();
  const d = metrics.data || {};
  const points = (d.series || []).filter((r) => r.cpu !== null).length;
  check('API serves Prometheus data', d.source === 'prometheus', `source=${d.source} ${d.sourceReason || ''}`);
  check('chart has points', points > 0, `${points} points with CPU`);
  console.log('\ncurrentSummary:', JSON.stringify(d.currentSummary));

  const del = await fetch(`${API_URL}/api/servers/${serverId}`, { method: 'DELETE', headers: authHeaders });
  check('temporary server removed', del.ok);
})().catch((err) => {
  console.error('ERROR', err.message, err.cause || '');
  process.exitCode = 1;
});
