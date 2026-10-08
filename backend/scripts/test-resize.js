/**
 * End-to-end resize workflow against a running API (seeded DB), using the Simulated provider:
 * integration → link → plan → request → approval rules → job steps → plan + cost updated.
 *
 * Usage: node scripts/test-resize.js     (API_URL defaults to http://127.0.0.1:5000)
 * Note: it really changes the plan of "Worker Server" and "Staging Integration Node" in the DB.
 */
const API_URL = process.env.API_URL || 'http://127.0.0.1:5000';

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

const login = async (email, password) => {
  const { data } = await call(null, 'POST', '/api/auth/login', { email, password });
  if (!data?.token) throw new Error(`login failed for ${email}`);
  return data.token;
};

const waitForJob = async (token, id, timeoutMs = 120000) => {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = (await call(token, 'GET', `/api/resize-requests/${id}`)).data.data;
    if (['succeeded', 'failed'].includes(last.status)) return last;
    await sleep(2000);
  }
  return last;
};

(async () => {
  const admin = await login('admin@example.com', 'Admin@123');
  const devops = await login('devops@example.com', 'DevOps@123');
  const viewer = await login('viewer@example.com', 'Viewer@123');

  const servers = (await call(admin, 'GET', '/api/servers')).data.data;
  const byName = (n) => servers.find((s) => s.name.startsWith(n));
  const prod = byName('Worker Server');
  const staging = byName('Staging Integration');
  const third = byName('Production API Server');
  const acme = byName('Storage Node');

  console.log('— Integration');
  check('viewer cannot add integrations', (await call(viewer, 'POST', '/api/integrations', { name: 'x', provider: 'Simulated' })).status === 403);
  check('devops cannot add integrations', (await call(devops, 'POST', '/api/integrations', { name: 'x', provider: 'Simulated' })).status === 403);
  check('Vultr requires an API key', (await call(admin, 'POST', '/api/integrations', { name: 'v', provider: 'Vultr' })).status === 400);
  const created = await call(admin, 'POST', '/api/integrations', { name: `Simulated test ${Date.now()}`, provider: 'Simulated' });
  const integration = created.data.data;
  check('simulated integration connects', created.status === 201 && created.data.check.ok);
  check('API never returns stored credentials', !('credentials' in integration));

  const inst = (await call(admin, 'GET', `/api/integrations/${integration._id}/instances`)).data;
  check('instances are matched to servers by IP', inst.data.some((i) => String(i.suggestedServerId) === prod._id), `${inst.data.length} instances`);
  const links = [prod, staging, third].map((s) => ({ instanceId: inst.data.find((i) => String(i.suggestedServerId) === s._id).id, serverId: s._id }));
  const linked = await call(admin, 'POST', `/api/integrations/${integration._id}/link`, { links });
  check('servers linked', linked.data.data.linked === 3, JSON.stringify(linked.data.data));

  console.log('— Plan');
  const plan = (await call(devops, 'GET', `/api/servers/${prod._id}/resize-options`)).data.data;
  check('plan is executable when linked', plan.executable, plan.notExecutableReason || '');
  check('production requires approval', plan.requiresApproval === true);
  check('candidates carry cost difference', plan.candidates.every((c) => typeof c.monthlyCostDelta === 'number'), `${plan.candidates.length} sizes`);
  const unlinked = (await call(admin, 'GET', '/api/servers')).data.data.find((s) => !s.providerRef?.instanceId);
  if (unlinked) {
    const unlinkedPlan = (await call(admin, 'GET', `/api/servers/${unlinked._id}/resize-options`)).data.data;
    check('unlinked server is plan-only', !unlinkedPlan.executable && /Link this server/.test(unlinkedPlan.notExecutableReason), unlinked.name);
  } else {
    console.log('SKIP  unlinked server is plan-only  (every server is linked)');
  }
  check('viewer cannot see another client’s plan', (await call(viewer, 'GET', `/api/servers/${acme._id}/resize-options`)).status === 404);

  const target = plan.candidates.find((c) => c.monthlyCostDelta > 0) || plan.candidates[0];

  console.log('— Request & approval (production)');
  // Outside the viewer's client the server is invisible (404); inside it the role is refused (403)
  check('viewer cannot request on another client’s server', (await call(viewer, 'POST', `/api/servers/${prod._id}/resize-requests`, { targetPlan: target.type, reason: 'test' })).status === 404);
  check('viewer cannot request on own client’s server', (await call(viewer, 'POST', `/api/servers/${staging._id}/resize-requests`, { targetPlan: target.type, reason: 'test' })).status === 403);
  check('reason is required', (await call(devops, 'POST', `/api/servers/${prod._id}/resize-requests`, { targetPlan: target.type })).status === 400);
  const reqRes = await call(devops, 'POST', `/api/servers/${prod._id}/resize-requests`, { targetPlan: target.type, reason: 'p95 memory above 85% for a week' });
  const request = reqRes.data.data;
  check('request created, waiting for approval', reqRes.status === 201 && request.status === 'pending_approval', request?.status);
  check('second request on same server blocked', (await call(admin, 'POST', `/api/servers/${prod._id}/resize-requests`, { targetPlan: target.type, reason: 'duplicate test' })).status === 409);
  check('requester cannot approve own request', (await call(devops, 'POST', `/api/resize-requests/${request._id}/approve`)).status === 403);
  check('viewer cannot approve', (await call(viewer, 'POST', `/api/resize-requests/${request._id}/approve`)).status === 403);
  const approved = await call(admin, 'POST', `/api/resize-requests/${request._id}/approve`, { comment: 'OK, off-peak' });
  check('second person approves → queued', approved.data.data?.status === 'queued', approved.data.data?.status);

  console.log('— Job');
  const done = await waitForJob(admin, request._id);
  check('resize job succeeded', done.status === 'succeeded', done.error || done.status);
  console.log(done.steps.map((s) => `        ${s.status.padEnd(7)} ${s.label}${s.detail ? ` — ${s.detail}` : ''}`).join('\n'));
  const after = (await call(admin, 'GET', `/api/servers/${prod._id}`)).data.data;
  check('server plan updated', after.instanceType === target.type, `${after.instanceType}`);
  check('server lock released and status restored', !after.operationLock?.type && after.status !== 'maintenance', after.status);
  const cost = (await call(admin, 'GET', `/api/costs/servers/${prod._id}`)).data.data;
  check('cost rate follows the new plan', cost.monthlyRate === target.priceMonthly, `${cost.monthlyRate} vs ${target.priceMonthly} (${cost.rateSource})`);
  const ops = (await call(admin, 'GET', `/api/operations?serverId=${prod._id}`)).data.data;
  check('resize recorded in Operations', ops.some((o) => o.operationType === 'Resize' && o.status === 'Succeeded'));

  console.log('— Non-production & cancel');
  const stPlan = (await call(devops, 'GET', `/api/servers/${staging._id}/resize-options`)).data.data;
  const stReq = (await call(devops, 'POST', `/api/servers/${staging._id}/resize-requests`, { targetPlan: stPlan.candidates[0].type, reason: 'right-size staging', takeSnapshot: false })).data.data;
  check('staging is queued without approval', stReq.status === 'queued' && !stReq.requiresApproval, stReq.status);
  const stDone = await waitForJob(admin, stReq._id);
  check('staging resize succeeded (snapshot skipped)', stDone.status === 'succeeded' && stDone.steps.find((s) => s.key === 'snapshot').status === 'skipped', stDone.error || '');

  const thPlan = (await call(devops, 'GET', `/api/servers/${third._id}/resize-options`)).data.data;
  const thReq = (await call(devops, 'POST', `/api/servers/${third._id}/resize-requests`, { targetPlan: thPlan.candidates[0].type, reason: 'will cancel this' })).data.data;
  check('other user cannot cancel', (await call(viewer, 'POST', `/api/resize-requests/${thReq._id}/cancel`)).status !== 200);
  check('requester can cancel before it starts', (await call(devops, 'POST', `/api/resize-requests/${thReq._id}/cancel`)).data.data?.status === 'cancelled');

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch((err) => {
  console.error('ERROR', err.message);
  process.exitCode = 1;
});
