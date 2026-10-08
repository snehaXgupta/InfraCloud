/**
 * Resize job runner (discovery doc §10 steps 6–9).
 *
 * Jobs are ResizeRequest documents in status "queued". The worker claims one atomically, runs
 * the steps below and saves progress after every step, so the UI can show it live.
 *
 *   precheck → lock → maintenance → snapshot → resize → provider (wait) → record → agent (wait)
 *
 * The new plan is recorded as soon as the provider confirms it, so the inventory always matches
 * reality even if the agent check afterwards fails. Interrupted jobs (API restart) are failed
 * safely and never retried automatically, because a provider call may already have happened.
 */
const os = require('os');
const ResizeRequest = require('../models/ResizeRequest');
const Server = require('../models/Server');
const Operation = require('../models/Operation');
const { loadAdapter } = require('./resizePlanner');
const costService = require('./costService');
const { logAudit } = require('./auditService');
const { sendAlertEmail } = require('./emailService');
const { ENABLE_RESIZE_EXECUTION } = require('../config/env');

const WORKER_ID = `${os.hostname()}:${process.pid}`;
const TICK_MS = 5000;
const POLL_MS = Number(process.env.RESIZE_POLL_MS || 5000);
const SNAPSHOT_TIMEOUT_MS = 45 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 20 * 60 * 1000;
const AGENT_TIMEOUT_MS = 10 * 60 * 1000;
const STALE_MS = 2 * 60 * 1000;
const LOCK_STALE_MS = 60 * 60 * 1000;

const STEPS = [
  ['precheck', 'Pre-checks (provider, instance, allowed size)'],
  ['lock', 'Lock server against other operations'],
  ['maintenance', 'Pause alerts (maintenance mode)'],
  ['snapshot', 'Take a snapshot'],
  ['resize', 'Request the new size from the provider'],
  ['provider', 'Wait for the provider to finish (server reboots)'],
  ['record', 'Update plan, specs and cost'],
  ['agent', 'Wait for the agent to report again'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const initialSteps = () => STEPS.map(([key, label]) => ({ key, label, status: 'pending' }));

/** Poll `check` until it returns a truthy value or the timeout passes. */
const waitFor = async (job, check, timeoutMs, what) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() > deadline) throw new Error(`Timed out after ${Math.round(timeoutMs / 60000)} min waiting for ${what}`);
    await ResizeRequest.updateOne({ _id: job._id }, { workerHeartbeatAt: new Date() });
    await sleep(POLL_MS);
  }
};

const runJob = async (job) => {
  const setStep = async (key, patch) => {
    const step = job.steps.find((s) => s.key === key);
    Object.assign(step, patch);
    job.workerHeartbeatAt = new Date();
    job.markModified('steps');
    await job.save();
  };
  const step = async (key, fn) => {
    await setStep(key, { status: 'running', startedAt: new Date() });
    const detail = await fn();
    await setStep(key, { status: detail === 'skipped' ? 'skipped' : 'done', detail: detail === 'skipped' ? undefined : detail, finishedAt: new Date() });
  };

  const operation = await Operation.create({
    serverId: job.serverId,
    operationType: 'Resize',
    requestedBy: job.requestedBy,
    status: 'Running',
    parameters: { from: job.fromPlan?.type, to: job.toPlan.type, requestId: job._id.toString() },
  });
  job.operationId = operation._id;

  let locked = false;
  let maintenanceSet = false;
  let resizeIssuedAt = null;

  try {
    let link;
    await step('precheck', async () => {
      const server = await Server.findById(job.serverId);
      if (!server) throw new Error('Server no longer exists');
      link = await loadAdapter(server);
      if (!link) throw new Error('Server is not linked to a provider account');
      if (link.integration.provider !== 'Simulated' && !ENABLE_RESIZE_EXECUTION) {
        throw new Error(`Resize execution for ${link.integration.provider} is switched off (ENABLE_RESIZE_EXECUTION)`);
      }
      const inst = await link.adapter.getInstance(link.instanceId);
      if (!inst.ready) throw new Error(`Instance is not ready (state: ${inst.state})`);
      if (inst.plan === job.toPlan.type) throw new Error(`Instance is already on ${job.toPlan.type}`);
      const allowed = await link.adapter.listUpgradePlans(link.instanceId);
      if (!allowed.some((p) => p.type === job.toPlan.type)) {
        throw new Error(`${job.toPlan.type} is no longer an allowed size for this instance`);
      }
      return `${link.integration.provider} instance ${link.instanceId} is running on ${inst.plan}`;
    });

    await step('lock', async () => {
      const claimed = await Server.findOneAndUpdate(
        {
          _id: job.serverId,
          $or: [{ operationLock: null }, { 'operationLock.at': { $lt: new Date(Date.now() - LOCK_STALE_MS) } }],
        },
        { $set: { operationLock: { type: 'Resize', by: job.requestedBy, at: new Date() } } },
        { new: true }
      );
      if (!claimed) throw new Error('Another operation is running on this server');
      locked = true;
      return 'Locked';
    });

    await step('maintenance', async () => {
      const server = await Server.findById(job.serverId).select('status');
      job.previousServerStatus = server.status;
      await Server.updateOne({ _id: job.serverId }, { status: 'maintenance' });
      maintenanceSet = true;
      return `Status ${server.status} → maintenance`;
    });

    await step('snapshot', async () => {
      if (!job.takeSnapshot) return 'skipped';
      const snapshotId = await link.adapter.createSnapshot(link.instanceId, `Before resize to ${job.toPlan.type} (${job._id})`);
      job.snapshotId = snapshotId;
      await job.save();
      await waitFor(
        job,
        async () => {
          const status = await link.adapter.getSnapshotStatus(snapshotId);
          if (status === 'failed') throw new Error(`Snapshot ${snapshotId} failed`);
          return status === 'complete';
        },
        SNAPSHOT_TIMEOUT_MS,
        'the snapshot'
      );
      return `Snapshot ${snapshotId} complete`;
    });

    await step('resize', async () => {
      await link.adapter.resizeInstance(link.instanceId, job.toPlan.type);
      resizeIssuedAt = new Date();
      return `Requested ${job.toPlan.type}`;
    });

    let finalInstance;
    await step('provider', async () => {
      finalInstance = await waitFor(
        job,
        async () => {
          const inst = await link.adapter.getInstance(link.instanceId);
          return inst.ready && inst.plan === job.toPlan.type ? inst : null;
        },
        PROVIDER_TIMEOUT_MS,
        'the provider to finish the resize'
      );
      return `Running on ${finalInstance.plan} (${finalInstance.vcpu} vCPU, ${finalInstance.ramGb} GB RAM)`;
    });

    await step('record', async () => {
      // A manual monthly rate was set for the old plan, so it no longer applies
      const before = await Server.findById(job.serverId).select('cost').lean();
      const staleManualRate = typeof before?.cost?.monthlyRate === 'number' ? before.cost.monthlyRate : null;
      await Server.updateOne(
        { _id: job.serverId },
        {
          $set: {
            instanceType: job.toPlan.type,
            'compute.vcpu': finalInstance.vcpu ?? job.toPlan.vcpu,
            'compute.ramGb': finalInstance.ramGb ?? job.toPlan.ramGb,
            'storage.diskTotalGb': finalInstance.diskGb ?? job.toPlan.diskGb,
          },
          ...(staleManualRate !== null ? { $unset: { cost: 1 } } : {}),
        }
      );
      await costService.ingest({ _id: job.serverId }); // today's accrual at the new plan's price
      await logAudit({
        action: 'RESIZE_APPLIED',
        resourceType: 'Server',
        resourceId: job.serverId,
        resourceName: job.serverName,
        details: { from: job.fromPlan?.type, to: job.toPlan.type, requestId: job._id.toString(), clearedManualRate: staleManualRate },
      });
      return (
        `Plan ${job.fromPlan?.type} → ${job.toPlan.type}; monthly cost ${job.monthlyCostDelta >= 0 ? '+' : ''}${job.monthlyCostDelta} ${job.currency}` +
        (staleManualRate !== null ? `; manual rate ${staleManualRate} cleared (set for the old plan)` : '')
      );
    });

    await step('agent', async () => {
      const server = await Server.findById(job.serverId).select('agent');
      if (!server.agent?.isLiveAgent) return 'skipped';
      await waitFor(
        job,
        async () => {
          const s = await Server.findById(job.serverId).select('agent.lastHeartbeat').lean();
          return s.agent?.lastHeartbeat && new Date(s.agent.lastHeartbeat) > resizeIssuedAt;
        },
        AGENT_TIMEOUT_MS,
        'the agent heartbeat'
      );
      return 'Agent heartbeat received after the resize';
    });

    job.status = 'succeeded';
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    const running = job.steps.find((s) => s.status === 'running');
    if (running) Object.assign(running, { status: 'failed', detail: err.message, finishedAt: new Date() });
    job.markModified('steps');
  } finally {
    if (maintenanceSet) {
      // The next heartbeat re-evaluates real health
      await Server.updateOne({ _id: job.serverId, status: 'maintenance' }, { status: job.previousServerStatus === 'maintenance' ? 'maintenance' : 'healthy' });
    }
    if (locked) await Server.updateOne({ _id: job.serverId, 'operationLock.type': 'Resize' }, { $set: { operationLock: null } });

    job.finishedAt = new Date();
    await job.save();

    const log = job.steps.map((s) => `[${s.status.toUpperCase()}] ${s.label}${s.detail ? ` — ${s.detail}` : ''}`).join('\n');
    await Operation.updateOne(
      { _id: operation._id },
      {
        status: job.status === 'succeeded' ? 'Succeeded' : 'Failed',
        output: log,
        executionTimeMs: job.finishedAt - (job.startedAt || job.createdAt),
        completedAt: job.finishedAt,
      }
    );
    await logAudit({
      action: job.status === 'succeeded' ? 'RESIZE_SUCCEEDED' : 'RESIZE_FAILED',
      resourceType: 'Server',
      resourceId: job.serverId,
      resourceName: job.serverName,
      status: job.status === 'succeeded' ? 'Success' : 'Failed',
      details: { to: job.toPlan.type, error: job.error, snapshotId: job.snapshotId },
    });
    if (job.status === 'failed') {
      sendAlertEmail({
        serverName: job.serverName,
        severity: 'Critical',
        metric: 'Resize',
        currentValue: job.toPlan.type,
        threshold: 'resize job',
        message: `Resize of ${job.serverName} to ${job.toPlan.type} failed: ${job.error}.${job.snapshotId ? ` Snapshot ${job.snapshotId} was taken before the change.` : ''}`,
      }).catch(() => {});
    }
  }
};

let busy = false;

const tick = async () => {
  if (busy) return;
  busy = true;
  try {
    const now = new Date();
    await recoverInterrupted();
    // Unapproved requests expire
    await ResizeRequest.updateMany({ status: 'pending_approval', expiresAt: { $lt: now } }, { status: 'expired', finishedAt: now });

    const job = await ResizeRequest.findOneAndUpdate(
      { status: 'queued', runAfter: { $lte: now } },
      { status: 'running', workerId: WORKER_ID, workerHeartbeatAt: now, startedAt: now },
      { sort: { runAfter: 1 }, new: true }
    );
    if (job) {
      if (!job.steps?.length) job.steps = initialSteps();
      await runJob(job);
    }
  } catch (err) {
    console.error('[Resize Worker Error]', err.message);
  } finally {
    busy = false;
  }
};

/**
 * Jobs left "running" by a dead worker: fail them safely and release what they held.
 * At startup every running job belongs to a previous process (one API instance per deployment);
 * later, a job whose worker stopped heart-beating for STALE_MS is treated the same way.
 */
const recoverInterrupted = async ({ atStartup = false } = {}) => {
  const stale = await ResizeRequest.find(
    atStartup
      ? { status: 'running', workerId: { $ne: WORKER_ID } }
      : { status: 'running', workerHeartbeatAt: { $lt: new Date(Date.now() - STALE_MS) } }
  );
  for (const job of stale) {
    job.status = 'failed';
    job.error = 'Interrupted: the control plane restarted during the resize. Check the server in the provider console before retrying.';
    job.finishedAt = new Date();
    await job.save();
    await Server.updateOne({ _id: job.serverId, 'operationLock.type': 'Resize' }, { $set: { operationLock: null } });
    await Server.updateOne({ _id: job.serverId, status: 'maintenance' }, { status: job.previousServerStatus || 'healthy' });
    if (job.operationId) await Operation.updateOne({ _id: job.operationId }, { status: 'Failed', completedAt: new Date() });
  }
};

const startResizeWorker = () => {
  setTimeout(() => {
    recoverInterrupted({ atStartup: true })
      .catch((err) => console.error('[Resize Worker Recovery Error]', err.message))
      .finally(() => setInterval(tick, TICK_MS).unref());
  }, 5000).unref();
};

module.exports = { startResizeWorker, initialSteps, STEPS };
