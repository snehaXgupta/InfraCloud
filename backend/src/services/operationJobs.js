/**
 * Operation execution through the agent (discovery doc §8.1 steps 4–9).
 *
 * The agent already calls the panel every few seconds (heartbeat). Queued jobs ride back on that
 * reply, so the server only ever makes outbound calls. The agent runs its own built-in script for
 * the job's catalog key, streams output, and reports a result with a post-check.
 *
 *  Queued ──(heartbeat, lock acquired)──▶ Dispatched ──(agent starts)──▶ Running
 *     ──(agent reports)──▶ Succeeded | Failed | Verifying ──(heartbeat proves it)──▶ Succeeded
 *
 * Jobs are signed with HMAC(sha256(agent token)) — the panel stores exactly that hash — so a
 * party without the agent's token cannot inject a job.
 */
const crypto = require('crypto');
const Operation = require('../models/Operation');
const Server = require('../models/Server');
const { CATALOG } = require('./operationCatalog');
const { logAudit } = require('./auditService');
const { sendAlertEmail } = require('./emailService');

const OUTPUT_LIMIT = 100 * 1024;
const LOCK_STALE_MS = 2 * 60 * 60 * 1000;
const PICKUP_TIMEOUT_MS = 5 * 60 * 1000;
const AGENT_ONLINE_MS = 90 * 1000;
const VERIFY_GRACE_MS = 15 * 60 * 1000;

// Never store or show secrets that a script happens to print
const REDACTIONS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]'],
  [/\b(sma_[A-Za-z0-9_-]{20,})/g, '[REDACTED TOKEN]'],
  [/\b(AKIA[0-9A-Z]{16})\b/g, '[REDACTED AWS KEY]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi, '$1[REDACTED]'],
  [/((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]'],
];
const redact = (text) => REDACTIONS.reduce((t, [re, rep]) => t.replace(re, rep), String(text || ''));

const appendOutput = (current, chunk) => {
  const next = (current || '') + redact(chunk);
  return next.length > OUTPUT_LIMIT ? `${next.slice(0, OUTPUT_LIMIT)}\n[output truncated]` : next;
};

const sign = (tokenHash, job) =>
  crypto.createHmac('sha256', tokenHash).update(`${job.id}|${job.key}|${JSON.stringify(job.params)}`).digest('hex');

const toJob = (op, tokenHash) => {
  const entry = CATALOG[op.operationType];
  const job = { id: op.jobId, key: entry.key, params: op.parameters || {}, timeoutSec: entry.timeoutSec };
  return { ...job, signature: sign(tokenHash, job) };
};

const releaseLock = (serverId, opId) =>
  Server.updateOne({ _id: serverId, 'operationLock.operationId': opId }, { $set: { operationLock: null } });

/** Final state + side effects: lock, audit, email on failure, replication hook. */
const finalize = async (op, status, { error, postCheck } = {}) => {
  const finished = await Operation.findOneAndUpdate(
    { _id: op._id, status: { $in: ['Queued', 'Dispatched', 'Running', 'Verifying'] } },
    {
      status,
      error,
      ...(postCheck ? { postCheck } : {}),
      completedAt: new Date(),
      executionTimeMs: Date.now() - new Date(op.dispatchedAt || op.queuedAt || op.createdAt).getTime(),
    },
    { new: true }
  );
  if (!finished) return null; // already final
  await releaseLock(op.serverId, op._id);

  await logAudit({
    action: status === 'Succeeded' ? 'OPERATION_SUCCEEDED' : 'OPERATION_FAILED',
    resourceType: 'Operation',
    resourceId: op._id,
    resourceName: `${op.operationType} on ${op.serverName}`,
    status: status === 'Succeeded' ? 'Success' : 'Failed',
    details: { exitCode: finished.exitCode, error, postCheck: finished.postCheck },
  });

  if (status !== 'Succeeded') {
    sendAlertEmail({
      serverName: op.serverName,
      severity: 'Warning',
      metric: 'Operation',
      currentValue: op.operationType,
      threshold: 'operation result',
      message: `${op.operationType} on ${op.serverName} failed: ${error || finished.postCheck?.detail || `exit code ${finished.exitCode}`}`,
    }).catch(() => {});
  }

  if (finished.replicationId) {
    // Lazy require: replicationService depends on this module
    await require('./replicationService').onSyncFinished(finished).catch((err) => console.error('[Replication hook]', err.message));
  }
  return finished;
};

/**
 * Called from every agent heartbeat. Returns the jobs to hand to this agent.
 * At most one operation per server runs at a time (per-server lock, §20).
 */
const jobsForAgent = async (server, credential) => {
  if (!(server.agent?.capabilities || []).includes('jobs')) return [];
  const now = new Date();

  // Re-send a dispatched job the agent hasn't acknowledged yet (lost reply); the agent de-duplicates
  const dispatched = await Operation.find({ serverId: server._id, status: 'Dispatched', dispatchedTo: credential._id }).sort({ dispatchedAt: 1 });
  if (dispatched.length) return dispatched.map((op) => toJob(op, credential.tokenHash));
  // A job already handed to another agent credential of this server is not offered again
  if (await Operation.exists({ serverId: server._id, status: { $in: ['Dispatched', 'Running', 'Verifying'] } })) return [];

  const next = await Operation.findOne({ serverId: server._id, status: 'Queued', runAfter: { $lte: now } }).sort({ queuedAt: 1 });
  if (!next) return [];

  const locked = await Server.findOneAndUpdate(
    {
      _id: server._id,
      $or: [{ operationLock: null }, { 'operationLock.at': { $lt: new Date(Date.now() - LOCK_STALE_MS) } }],
    },
    { $set: { operationLock: { type: next.operationType, by: next.requestedBy, at: now, operationId: next._id } } }
  );
  if (!locked) return []; // another operation (or a resize) holds the server; try on a later heartbeat

  const entry = CATALOG[next.operationType];
  const verify = {};
  if (entry.verify === 'reboot') verify.bootTimeBefore = server.agent?.bootTime;
  if (entry.verify === 'version') verify.expectedVersion = next.parameters?.version;

  const op = await Operation.findOneAndUpdate(
    { _id: next._id, status: 'Queued' },
    {
      status: 'Dispatched',
      jobId: next.jobId || crypto.randomUUID(),
      dispatchedAt: now,
      dispatchedTo: credential._id,
      deadlineAt: new Date(now.getTime() + entry.timeoutSec * 1000 + 60 * 1000),
      verify,
    },
    { new: true }
  );
  if (!op) {
    await releaseLock(server._id, next._id);
    return [];
  }
  if (op.replicationId) await require('./replicationService').markRunning(op.replicationId);
  return [toJob(op, credential.tokenHash)];
};

/** Agent → panel: job started / more output. */
const recordProgress = async (serverId, credentialId, jobId, { output }) => {
  const op = await Operation.findOne({ jobId, serverId, dispatchedTo: credentialId });
  if (!op || !['Dispatched', 'Running'].includes(op.status)) return null;
  if (op.status === 'Dispatched') {
    op.status = 'Running';
    op.startedAt = new Date();
  }
  if (output) op.output = appendOutput(op.output, output);
  await op.save();
  return op;
};

/** Agent → panel: job finished. */
const recordResult = async (serverId, credentialId, jobId, { exitCode, output, result, postCheck }) => {
  const op = await Operation.findOne({ jobId, serverId, dispatchedTo: credentialId });
  if (!op || !['Dispatched', 'Running'].includes(op.status)) return null;

  op.exitCode = Number.isInteger(exitCode) ? exitCode : -1;
  if (output) op.output = appendOutput(op.output, output);
  if (result !== undefined) op.result = JSON.parse(redact(JSON.stringify(result)).slice(0, 50000) || 'null');
  const check = postCheck ? { ok: !!postCheck.ok, detail: redact(String(postCheck.detail || '')).slice(0, 500) } : undefined;
  if (check) op.postCheck = check;
  await op.save();

  const entry = CATALOG[op.operationType];
  if (op.exitCode !== 0) return finalize(op, 'Failed', { error: `Exit code ${op.exitCode}`, postCheck: check });
  if (check && !check.ok) return finalize(op, 'Failed', { error: check.detail || 'Post-check failed', postCheck: check });

  if (entry.verify === 'agent') return finalize(op, 'Succeeded', { postCheck: check });

  // Reboot / agent update: success is proven by the next heartbeats
  op.status = 'Verifying';
  op.deadlineAt = new Date(Date.now() + VERIFY_GRACE_MS);
  await op.save();
  return op;
};

/** Called from every heartbeat after the server's agent fields are updated. */
const verifyFromHeartbeat = async (server) => {
  const op = await Operation.findOne({ serverId: server._id, status: 'Verifying' });
  if (!op) return;
  const entry = CATALOG[op.operationType];

  if (entry.verify === 'reboot') {
    const before = op.verify?.bootTimeBefore ? new Date(op.verify.bootTimeBefore).getTime() : 0;
    const now = server.agent?.bootTime ? new Date(server.agent.bootTime).getTime() : 0;
    if (now && now - before > 60 * 1000) {
      await finalize(op, 'Succeeded', { postCheck: { ok: true, detail: `Server rebooted at ${new Date(now).toISOString()} and reported back` } });
    }
  } else if (entry.verify === 'version') {
    if (server.agent?.version && server.agent.version === op.verify?.expectedVersion) {
      await finalize(op, 'Succeeded', { postCheck: { ok: true, detail: `Agent now reports ${server.agent.version}` } });
    }
  }
};

/** Periodic housekeeping: approvals that expired, jobs no agent picked up, jobs past their deadline. */
const sweep = async () => {
  const now = new Date();
  await Operation.updateMany(
    { status: 'Awaiting Approval', approvalExpiresAt: { $lt: now } },
    { status: 'Expired', completedAt: now, error: 'Not approved in time' }
  );

  const stuckQueued = await Operation.find({ status: 'Queued', queuedAt: { $lt: new Date(now - PICKUP_TIMEOUT_MS) }, runAfter: { $lt: new Date(now - PICKUP_TIMEOUT_MS) } });
  for (const op of stuckQueued) {
    const server = await Server.findById(op.serverId).select('agent operationLock').lean();
    const online = server?.agent?.lastHeartbeat && now - new Date(server.agent.lastHeartbeat) < AGENT_ONLINE_MS;
    const capable = (server?.agent?.capabilities || []).includes('jobs');
    if (!online || !capable) {
      await finalize(op, 'Failed', {
        error: !online ? 'The agent is offline, so the job was never picked up' : 'The agent on this server is too old to run operations — reinstall it with the install command',
      });
    }
  }

  const overdue = await Operation.find({ status: { $in: ['Dispatched', 'Running', 'Verifying'] }, deadlineAt: { $lt: now } });
  for (const op of overdue) {
    await finalize(op, 'Failed', {
      error: op.status === 'Verifying' ? 'The server did not confirm the result in time' : `Timed out after ${CATALOG[op.operationType]?.timeoutSec}s`,
    });
  }
};

const startOperationSweeper = () => {
  setInterval(() => sweep().catch((err) => console.error('[Operation Sweeper]', err.message)), 15 * 1000).unref();
};

module.exports = { jobsForAgent, recordProgress, recordResult, verifyFromHeartbeat, finalize, startOperationSweeper, redact };
