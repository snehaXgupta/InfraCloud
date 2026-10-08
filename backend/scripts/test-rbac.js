/**
 * RBAC + tenant isolation checks against a running API seeded with `npm run seed`.
 * Covers discovery doc §23: "Unauthorized users cannot execute operations" and §24 "Tenant leakage".
 *
 * Usage: node scripts/test-rbac.js        (API_URL defaults to http://127.0.0.1:5000)
 */
const WebSocket = require('ws');

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000';
const ACCOUNTS = {
  admin: ['admin@example.com', 'Admin@123'],
  devops: ['devops@example.com', 'DevOps@123'],
  auditor: ['auditor@example.com', 'Auditor@123'],
  clientAdmin: ['client.admin@example.com', 'Client@123'],
  viewer: ['viewer@example.com', 'Viewer@123'],
  billing: ['billing@example.com', 'Billing@123'],
};

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

const call = async (token, method, path, body) => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body
  }
  return { status: res.status, data };
};

const login = async ([email, password]) => {
  const { data } = await call(null, 'POST', '/api/auth/login', { email, password });
  if (!data?.token) throw new Error(`login failed for ${email} — run \`npm run seed\` first`);
  return data.token;
};

const wsCloseCode = (url) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url);
    ws.on('close', (code) => resolve(code));
    ws.on('error', () => resolve('error'));
    setTimeout(() => resolve('timeout'), 5000);
  });

(async () => {
  const t = {};
  for (const [role, creds] of Object.entries(ACCOUNTS)) t[role] = await login(creds);

  const all = (await call(t.admin, 'GET', '/api/servers')).data.data;
  const clients = (await call(t.admin, 'GET', '/api/clients')).data.data;
  const nexus = clients.find((c) => /Nexus/.test(c.name));
  const acme = clients.find((c) => /Acme/.test(c.name));
  const clientOf = (s) => (s.clientId?._id || s.clientId).toString();
  const acmeServer = all.find((s) => clientOf(s) === acme._id.toString());
  const nexusServer = all.find((s) => clientOf(s) === nexus._id.toString());

  console.log('— Registration');
  const reg = await call(null, 'POST', '/api/auth/register', { name: 'x', email: `x${Date.now()}@e.com`, password: 'Password123!', role: 'Platform Admin' });
  check('public self-registration is disabled', reg.status === 403, `HTTP ${reg.status}`);

  console.log('— Tenant isolation (Client Viewer, scoped to Nexus)');
  const vServers = (await call(t.viewer, 'GET', '/api/servers')).data.data;
  check('viewer lists only Nexus servers', vServers.length > 0 && vServers.every((s) => clientOf(s) === nexus._id.toString()), `${vServers.length} of ${all.length}`);
  check('viewer cannot open an Acme server', (await call(t.viewer, 'GET', `/api/servers/${acmeServer._id}`)).status === 404);
  check('viewer cannot read Acme metrics', (await call(t.viewer, 'GET', `/api/servers/${acmeServer._id}/metrics`)).status === 404);
  check('viewer cannot open Acme client', (await call(t.viewer, 'GET', `/api/clients/${acme._id}`)).status === 404);
  const vAlerts = (await call(t.viewer, 'GET', '/api/alerts')).data.data;
  const vServerIds = new Set(vServers.map((s) => s._id.toString()));
  check('viewer alerts are all on Nexus servers', vAlerts.every((a) => vServerIds.has((a.serverId?._id || a.serverId).toString())), `${vAlerts.length} alerts`);
  const { counts } = (await call(t.viewer, 'GET', '/api/dashboard/summary')).data.data;
  check(
    'viewer dashboard counts are scoped',
    counts.clients === 1 && counts.servers === vServers.length && counts.users === 0 && counts.totalAuditLogs === 0,
    `clients=${counts.clients} servers=${counts.servers} users=${counts.users}`
  );
  check('viewer can open a Nexus server', (await call(t.viewer, 'GET', `/api/servers/${nexusServer._id}`)).status === 200);

  console.log('— Action permissions');
  check('viewer cannot run operations', (await call(t.viewer, 'POST', '/api/operations', { serverId: nexusServer._id, operationType: 'Health Check' })).status === 403);
  check('viewer cannot list operations', (await call(t.viewer, 'GET', '/api/operations')).status === 403);
  check('client admin cannot run operations', (await call(t.clientAdmin, 'POST', '/api/operations', { serverId: nexusServer._id, operationType: 'Health Check' })).status === 403);
  check('auditor cannot run operations', (await call(t.auditor, 'POST', '/api/operations', { serverId: nexusServer._id, operationType: 'Health Check' })).status === 403);
  check('devops cannot delete servers', (await call(t.devops, 'DELETE', `/api/servers/${nexusServer._id}`)).status === 403);
  check('devops cannot manage users', (await call(t.devops, 'GET', '/api/users')).status === 403);
  check('client admin cannot read audit log', (await call(t.clientAdmin, 'GET', '/api/audit-logs')).status === 403);
  check('auditor can read audit log', (await call(t.auditor, 'GET', '/api/audit-logs')).status === 200);
  check('viewer cannot issue agent tokens', (await call(t.viewer, 'POST', `/api/servers/${nexusServer._id}/agent-token`)).status === 403);
  check('viewer cannot request a resize', (await call(t.viewer, 'POST', `/api/servers/${nexusServer._id}/resize-requests`, { targetPlan: 'x', reason: 'test' })).status === 403);
  check('viewer cannot create alerts', (await call(t.viewer, 'POST', '/api/alerts/simulate', {})).status === 403);
  check('devops can run a health check', [200, 201].includes((await call(t.devops, 'POST', '/api/operations', { serverId: nexusServer._id, operationType: 'Health Check' })).status));

  console.log('— Operation safety');
  const parallel = await Promise.all(
    Array.from({ length: 5 }, () => call(t.devops, 'POST', '/api/operations', { serverId: nexusServer._id, operationType: 'Sync' }))
  );
  // Simulated operations finish in milliseconds, so a later request may legitimately take the
  // released lock. The guarantee is that no two runs on one server ever overlap in time.
  const runs = parallel
    .filter((r) => r.status === 201)
    .map((r) => [new Date(r.data.data.createdAt).getTime(), new Date(r.data.data.completedAt || r.data.data.updatedAt).getTime()])
    .sort((x, y) => x[0] - y[0]);
  const overlapping = runs.some((run, i) => i > 0 && run[0] < runs[i - 1][1]);
  const blocked = parallel.filter((r) => r.status === 409).length;
  check(
    'concurrent operations on one server never overlap',
    runs.length >= 1 && blocked >= 1 && runs.length + blocked === 5 && !overlapping,
    `${runs.length} ran one after another, ${blocked} blocked`
  );
  check('viewer cannot approve resizes', (await call(t.viewer, 'POST', '/api/resize-requests/000000000000000000000000/approve')).status === 403);

  console.log('— Costs');
  const vCost = (await call(t.viewer, 'GET', '/api/costs/summary')).data.data;
  check('viewer cost summary is scoped to Nexus', vCost.byClient.every((c) => c.id === nexus._id.toString()), vCost.byClient.map((c) => c.name).join(', '));
  check('cost figures carry a label and sync time', ['Estimated', 'Actual', 'Mixed'].includes(vCost.totals.label) && !!vCost.lastSyncedAt);
  check('viewer cannot open Acme server cost', (await call(t.viewer, 'GET', `/api/costs/servers/${acmeServer._id}`)).status === 404);
  check('viewer cannot set server rates', (await call(t.viewer, 'PUT', `/api/costs/servers/${nexusServer._id}/rate`, { monthlyRate: 1 })).status === 403);
  check('devops cannot import invoices', (await call(t.devops, 'POST', '/api/costs/actuals', { month: '2026-01', lines: [] })).status === 403);
  check('billing can sync costs', (await call(t.billing, 'POST', '/api/costs/refresh')).status === 200);

  console.log('— Agent endpoints');
  check('heartbeat without token rejected', (await call(null, 'POST', '/api/agent/heartbeat', { cpuUsage: 1 })).status === 401);
  const ingest = await fetch(`${API_URL}/ingest/metrics`, { method: 'POST', headers: { 'Content-Encoding': 'snappy' }, body: Buffer.from([0]) });
  check('metrics ingest without token rejected', ingest.status === 401);

  console.log('— Web terminal');
  const wsBase = API_URL.replace(/^http/, 'ws');
  const code = await wsCloseCode(`${wsBase}/ws/terminal?token=${t.admin}`);
  if (process.env.ENABLE_WEB_TERMINAL === 'true') {
    const viewerCode = await wsCloseCode(`${wsBase}/ws/terminal?token=${t.viewer}`);
    check('terminal refuses non-admin', viewerCode === 4001, `close ${viewerCode}`);
  } else {
    check('terminal disabled by default', code === 4003, `close ${code}`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch((err) => {
  console.error('ERROR', err.message);
  process.exitCode = 1;
});
