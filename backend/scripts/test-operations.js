/**
 * Operations (§8) and replication (§9) end to end.
 *
 * Part A — real agent: runs catalog operations on the server named "Payment API Gateway 01"
 *          (the WSL host) when its agent is online with the `jobs` capability.
 * Part B — protocol: this script plays the agent for two TEMPORARY servers (primary + replica)
 *          to check replication states/alerts, approvals, job signatures, sync and reboot
 *          verification deterministically. The temporary servers are deleted afterwards.
 *
 * Usage: node scripts/test-operations.js   (API_URL defaults to http://127.0.0.1:5000)
 */
const crypto = require('crypto');

const API_URL = process.env.API_URL || 'http://127.0.0.1:5000';
const REAL_SERVER = process.env.REAL_SERVER || 'Payment API Gateway 01';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    // empty
  }
  return { status: res.status, data };
};
const login = async (email, password) => (await call(null, 'POST', '/api/auth/login', { email, password })).data.token;

const waitFinal = async (token, id, timeoutMs = 120000) => {
  const deadline = Date.now() + timeoutMs;
  let op;
  while (Date.now() < deadline) {
    op = (await call(token, 'GET', `/api/operations/${id}`)).data.data;
    if (['Succeeded', 'Failed', 'Rejected', 'Cancelled', 'Expired'].includes(op.status)) return op;
    await sleep(2000);
  }
  return op;
};

(async () => {
  const admin = await login('admin@example.com', 'Admin@123');
  const devops = await login('devops@example.com', 'DevOps@123');
  const viewer = await login('viewer@example.com', 'Viewer@123');
  const servers = (await call(admin, 'GET', '/api/servers')).data.data;

  // ── Part A: real agent ──────────────────────────────────────────────────────
  const real = servers.find((s) => s.name === REAL_SERVER);
  const realReady =
    real && (real.agent?.capabilities || []).includes('jobs') && Date.now() - new Date(real.agent?.lastHeartbeat) < 60000;
  console.log(`— Part A: real agent on "${REAL_SERVER}"${realReady ? '' : ' — SKIPPED (agent offline or too old)'}`);
  if (realReady) {
    const run = (token, body) => call(token, 'POST', '/api/operations', { serverId: real._id, ...body });

    const hc = await run(devops, { operationType: 'Health Check' });
    check('health check queued without approval', hc.status === 201 && hc.data.data.status === 'Queued', hc.data.error || hc.data.data?.status);
    const hcDone = await waitFinal(admin, hc.data.data._id);
    check('health check ran on the server', hcDone.status === 'Succeeded' && /CPU/.test(hcDone.output), `${hcDone.status} · ${hcDone.postCheck?.detail}`);
    check('health check returned structured result', Array.isArray(hcDone.result?.failedServices) && typeof hcDone.result?.diskUsage === 'number');

    check('arbitrary shell is refused', (await run(devops, { operationType: 'Health Check', command: 'rm -rf /' })).status === 400);
    await call(admin, 'PUT', `/api/servers/${real._id}`, { allowedServices: [] });
    check('service not on allow-list is refused', (await run(devops, { operationType: 'Service Restart', parameters: { service: 'cron' }, reason: 'test restart' })).status === 400);

    await call(admin, 'PUT', `/api/servers/${real._id}`, { allowedServices: ['cron'] });
    check('injection in service name is refused', (await run(devops, { operationType: 'Service Restart', parameters: { service: 'cron;reboot' }, reason: 'test restart' })).status === 400);

    const sr = await run(devops, { operationType: 'Service Restart', parameters: { service: 'cron' }, reason: 'Test restart of cron' });
    check('production service restart needs approval', sr.data.data?.status === 'Awaiting Approval', sr.data.error || sr.data.data?.status);
    check('requester cannot approve own operation', (await call(devops, 'POST', `/api/operations/${sr.data.data._id}/approve`)).status === 403);
    check('viewer cannot approve', [403, 404].includes((await call(viewer, 'POST', `/api/operations/${sr.data.data._id}/approve`)).status));
    await call(admin, 'POST', `/api/operations/${sr.data.data._id}/approve`, { comment: 'ok' });
    const srDone = await waitFinal(admin, sr.data.data._id);
    check('service restarted and verified active', srDone.status === 'Succeeded' && srDone.postCheck?.ok, `${srDone.status} · ${srDone.postCheck?.detail || srDone.error}`);

    const cl = await run(admin, { operationType: 'Cleanup', parameters: { dryRun: true }, reason: 'Check reclaimable space' });
    await call(devops, 'POST', `/api/operations/${cl.data.data._id}/approve`);
    const clDone = await waitFinal(admin, cl.data.data._id);
    check('cleanup dry-run ran and deleted nothing', clDone.status === 'Succeeded' && clDone.result?.dryRun === true, clDone.postCheck?.detail || clDone.error);

    const two = await Promise.all([run(devops, { operationType: 'Health Check' }), run(devops, { operationType: 'Health Check' })]);
    const [d1, d2] = await Promise.all(two.map((r) => waitFinal(admin, r.data.data._id)));
    const overlap = new Date(d1.dispatchedAt) < new Date(d2.completedAt) && new Date(d2.dispatchedAt) < new Date(d1.completedAt);
    check('two operations on one server run one at a time', d1.status === 'Succeeded' && d2.status === 'Succeeded' && !overlap);

    const au = await run(devops, { operationType: 'Agent Update' });
    const auDone = await waitFinal(admin, au.data.data._id, 180000);
    check('agent update verified by the new heartbeat', auDone.status === 'Succeeded', auDone.postCheck?.detail || auDone.error);
  }

  // ── Part B: protocol with temporary servers ────────────────────────────────
  console.log('— Part B: replication, approvals, signatures, reboot (temporary servers)');
  const template = servers.find((s) => /Nexus/.test(s.clientId?.name || '')) || servers[0];
  const idOf = (v) => v?._id || v;
  const mk = async (name, ip) =>
    (
      await call(admin, 'POST', '/api/servers', {
        name,
        hostname: `${name}.test.local`,
        clientId: idOf(template.clientId),
        projectId: idOf(template.projectId),
        environmentId: idOf(template.environmentId),
        provider: 'On-Premise',
        network: { publicIp: ip, privateIp: ip },
      })
    ).data.data;
  const stamp = Date.now();
  const primary = await mk(`ops-test-primary-${stamp}`, '192.0.2.10');
  const replica = await mk(`ops-test-replica-${stamp}`, '192.0.2.11');
  const token = async (s) => (await call(admin, 'POST', `/api/servers/${s._id}/agent-token`)).data.data.token;
  const pTok = await token(primary);
  const rTok = await token(replica);

  let replicaUptime = 100000;
  const beat = (tok, extra = {}, uptime = 100000) =>
    call(tok, 'POST', '/api/agent/heartbeat', {
      cpuUsage: 10,
      memoryUsage: 30,
      diskUsage: 40,
      uptimeSeconds: uptime,
      agentVersion: '2.6.0',
      capabilities: ['jobs', 'replication'],
      ...extra,
    });

  try {
    await beat(pTok);
    await beat(rTok, {}, replicaUptime);

    const rel = await call(devops, 'POST', '/api/replication', { primaryServerId: primary._id, replicaServerId: replica._id, kind: 'postgres', lagWarnSeconds: 60, lagCritSeconds: 300 });
    check('replication relationship created', rel.status === 201, rel.data.error);
    check('a replica cannot have two primaries', (await call(devops, 'POST', '/api/replication', { primaryServerId: primary._id, replicaServerId: replica._id, kind: 'postgres' })).status === 409);

    const hb = (await beat(rTok, {}, replicaUptime)).data;
    check('replica agent is asked to measure lag', hb.replicationChecks?.some((c) => c.id === rel.data.data._id && c.kind === 'postgres'));

    await beat(rTok, { replication: [{ id: rel.data.data._id, ok: true, lagSeconds: 500 }] }, replicaUptime);
    let view = (await call(admin, 'GET', '/api/replication')).data.data.find((r) => r._id === rel.data.data._id);
    check('lag above critical → Sync Required', view.state === 'Sync Required', `${view.state}, lag ${view.lastLagSeconds}s`);
    const alerts = (await call(admin, 'GET', `/api/alerts?serverId=${replica._id}`)).data.data;
    check('critical replication alert opened', alerts.some((a) => a.metric === 'Replication Delay' && a.severity === 'Critical' && a.status !== 'resolved'));

    await beat(rTok, { replication: [{ id: rel.data.data._id, ok: true, lagSeconds: 120 }] }, replicaUptime);
    view = (await call(admin, 'GET', '/api/replication')).data.data.find((r) => r._id === rel.data.data._id);
    check('lag between warn and critical → Degraded', view.state === 'Degraded', view.state);

    const syncBody = { serverId: replica._id, operationType: 'Sync', parameters: { relationshipId: rel.data.data._id }, reason: 'Replica fell behind' };
    check('sync without typing the name is refused', (await call(devops, 'POST', '/api/operations', syncBody)).status === 400);
    check('sync on the primary is refused', (await call(devops, 'POST', '/api/operations', { ...syncBody, serverId: primary._id, confirmName: primary.name })).status === 400);
    const sync = await call(devops, 'POST', '/api/operations', { ...syncBody, confirmName: replica.name });
    check('sync always needs approval', sync.data.data?.status === 'Awaiting Approval', sync.data.error || sync.data.data?.status);
    await call(admin, 'POST', `/api/operations/${sync.data.data._id}/approve`);

    const jobsBeat = (await beat(rTok, {}, replicaUptime)).data;
    const job = jobsBeat.jobs?.[0];
    check('approved sync is handed to the replica agent', job?.key === 'replica-sync', job?.key);
    const expected = crypto
      .createHmac('sha256', crypto.createHash('sha256').update(rTok).digest('hex'))
      .update(`${job.id}|${job.key}|${JSON.stringify(job.params)}`)
      .digest('hex');
    check('job is signed with the agent’s token', job.signature === expected);
    check('job carries the primary to sync from', job.params.primaryName === primary.name);

    view = (await call(admin, 'GET', '/api/replication')).data.data.find((r) => r._id === rel.data.data._id);
    check('state → Sync Running while the job runs', view.state === 'Sync Running', view.state);

    await call(rTok, 'POST', `/api/agent/jobs/${job.id}/progress`, { output: 'base backup… password=hunter2\n' });
    await call(rTok, 'POST', `/api/agent/jobs/${job.id}/result`, { exitCode: 0, output: 'streaming\n', result: { lagSeconds: 0.5 }, postCheck: { ok: true, detail: 'Replica lag after sync: 0 s' } });
    const syncDone = (await call(admin, 'GET', `/api/operations/${sync.data.data._id}`)).data.data;
    check('sync succeeded', syncDone.status === 'Succeeded', syncDone.status);
    check('secrets in output are redacted', !/hunter2/.test(syncDone.output) && /REDACTED/.test(syncDone.output));
    view = (await call(admin, 'GET', '/api/replication')).data.data.find((r) => r._id === rel.data.data._id);
    check('state → Sync Verified', view.state === 'Sync Verified', view.state);
    const after = (await call(admin, 'GET', `/api/alerts?serverId=${replica._id}`)).data.data;
    check('replication alert resolved', !after.some((a) => a.metric === 'Replication Delay' && a.status !== 'resolved'));

    // Reboot: success only when the heartbeat shows a new boot time
    const rb = await call(devops, 'POST', '/api/operations', { serverId: replica._id, operationType: 'Reboot', confirmName: replica.name, reason: 'Kernel update' });
    await call(admin, 'POST', `/api/operations/${rb.data.data._id}/approve`);
    const rbJob = (await beat(rTok, {}, replicaUptime)).data.jobs?.[0];
    await call(rTok, 'POST', `/api/agent/jobs/${rbJob.id}/result`, { exitCode: 0, output: 'Shutdown scheduled\n', postCheck: { ok: true, detail: 'Reboot scheduled' } });
    let rbOp = (await call(admin, 'GET', `/api/operations/${rb.data.data._id}`)).data.data;
    check('reboot waits for proof (Verifying)', rbOp.status === 'Verifying', rbOp.status);
    await beat(rTok, {}, 30); // came back: uptime 30 s → new boot time
    rbOp = (await call(admin, 'GET', `/api/operations/${rb.data.data._id}`)).data.data;
    check('reboot verified by new boot time', rbOp.status === 'Succeeded', rbOp.postCheck?.detail || rbOp.status);

    // Failed job → failure recorded and lock released
    const hcF = await call(devops, 'POST', '/api/operations', { serverId: replica._id, operationType: 'Health Check' });
    const fJob = (await beat(rTok, {}, 30)).data.jobs?.[0];
    await call(rTok, 'POST', `/api/agent/jobs/${fJob.id}/result`, { exitCode: 0, output: '', postCheck: { ok: false, detail: '2 failed service(s)' } });
    const fOp = (await call(admin, 'GET', `/api/operations/${hcF.data.data._id}`)).data.data;
    check('failed post-check → Failed', fOp.status === 'Failed' && /failed service/.test(fOp.error), fOp.error);
    const replicaAfter = (await call(admin, 'GET', `/api/servers/${replica._id}`)).data.data;
    check('server lock released after failure', !replicaAfter.operationLock?.type);

    await call(devops, 'DELETE', `/api/replication/${rel.data.data._id}`);
  } finally {
    await call(admin, 'DELETE', `/api/servers/${primary._id}`);
    await call(admin, 'DELETE', `/api/servers/${replica._id}`);
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch((err) => {
  console.error('ERROR', err.message);
  process.exitCode = 1;
});
