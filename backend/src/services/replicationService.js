/**
 * Replica health and sync (discovery doc §9).
 *
 * - The replica's agent measures replication lag locally (database credentials never leave the
 *   server) and reports it with its heartbeat.
 * - Lag drives the state: ≤ warn → Healthy, ≤ crit → Degraded (Warning alert),
 *   > crit / not replicating → Sync Required (Critical alert). A down primary → Primary Down.
 * - Sync / Replica Recovery are operations on the replica (§8 engine) with prechecks; the job's
 *   own post-check re-measures lag, and success moves the state to Sync Verified.
 */
const ServerRelationship = require('../models/ServerRelationship');
const Server = require('../models/Server');
const { openAlert, resolveAlerts } = require('./thresholdAlerts');

const HISTORY_POINTS = 120;
const AGENT_ONLINE_MS = 90 * 1000;

const isOnline = (server) =>
  server?.status !== 'offline' && server?.agent?.lastHeartbeat && Date.now() - new Date(server.agent.lastHeartbeat) < AGENT_ONLINE_MS;

const setState = async (rel, state) => {
  if (rel.state === state) return;
  rel.state = state;
  rel.stateChangedAt = new Date();
};

/** Recompute state + alerts for one relationship (after a lag report or a sync result). */
const evaluate = async (rel) => {
  const [primary, replica] = await Promise.all([
    Server.findById(rel.primaryServerId).select('name hostname status agent network').lean(),
    Server.findById(rel.replicaServerId),
  ]);
  if (!replica) return;

  if (['Sync Running'].includes(rel.state)) return;

  if (!isOnline(primary)) {
    await setState(rel, 'Primary Down');
    return;
  }

  const lag = rel.lastLagSeconds;
  const broken = rel.lastCheckError || lag == null;
  let next;
  if (broken || lag > rel.lagCritSeconds) next = 'Sync Required';
  else if (lag > rel.lagWarnSeconds) next = 'Degraded';
  else next = 'Healthy';

  // Sync Verified stays visible until the next healthy measurement confirms it
  if (rel.state === 'Sync Verified' && next === 'Healthy' && Date.now() - new Date(rel.stateChangedAt) < 60 * 1000) next = 'Sync Verified';
  await setState(rel, next);

  const detail = broken
    ? `Replica ${replica.name} is not replicating from ${primary.name}: ${rel.lastCheckError || 'no lag reported'}`
    : `Replica ${replica.name} is ${Math.round(lag)} s behind ${primary.name}`;

  if (next === 'Sync Required') {
    await openAlert(replica, {
      metric: 'Replication Delay',
      severity: 'Critical',
      value: broken ? 'not replicating' : `${Math.round(lag)}s`,
      threshold: `>${rel.lagCritSeconds}s`,
      message: `${detail}. Run Sync from the Replication page.`,
    });
  } else if (next === 'Degraded') {
    await openAlert(replica, {
      metric: 'Replication Delay',
      severity: 'Warning',
      value: `${Math.round(lag)}s`,
      threshold: `>${rel.lagWarnSeconds}s`,
      message: detail,
    });
  } else {
    await resolveAlerts(replica, 'Replication Delay', `${Math.round(lag ?? 0)}s`);
  }
};

/** Heartbeat → which checks this server's agent should run (it is a replica). */
const checksForAgent = async (server) => {
  if (!(server.agent?.capabilities || []).includes('replication')) return [];
  const rels = await ServerRelationship.find({ replicaServerId: server._id }).select('kind').lean();
  return rels.map((r) => ({ id: String(r._id), kind: r.kind }));
};

/** Heartbeat ← lag results from the replica's agent. */
const recordChecks = async (server, results = []) => {
  for (const r of Array.isArray(results) ? results.slice(0, 20) : []) {
    const rel = await ServerRelationship.findOne({ _id: r.id, replicaServerId: server._id }).catch(() => null);
    if (!rel) continue;
    const lag = typeof r.lagSeconds === 'number' && Number.isFinite(r.lagSeconds) && r.lagSeconds >= 0 ? r.lagSeconds : null;
    rel.lastCheckAt = new Date();
    rel.lastLagSeconds = lag;
    rel.lastCheckError = r.ok === false || lag === null ? String(r.error || 'not replicating').slice(0, 300) : undefined;
    rel.lagHistory.push({ at: new Date(), lag });
    if (rel.lagHistory.length > HISTORY_POINTS) rel.lagHistory = rel.lagHistory.slice(-HISTORY_POINTS);
    await evaluate(rel);
    await rel.save();
  }
};

/**
 * Validate a Sync / Replica Recovery request (§9 "Before sync"): explicit direction, both agents
 * online, primary healthy, replica disk space, no other sync on this replica.
 * @returns {{ params, relationship } | { error }}
 */
const prepareSync = async (server, params = {}) => {
  const rel = await ServerRelationship.findOne({ _id: params.relationshipId, replicaServerId: server._id }).catch(() => null);
  if (!rel) return { error: 'This server is not a replica in that relationship — sync always runs on the replica' };
  const primary = await Server.findById(rel.primaryServerId).lean();
  if (!isOnline(primary)) return { error: `Primary ${primary?.name || ''} is down — recover the primary first, then sync the replica` };
  if (['critical'].includes(primary.status)) return { error: `Primary ${primary.name} is critical — fix it before syncing from it` };
  if (!isOnline(server)) return { error: 'The replica’s agent is offline' };
  if ((server.metricsSummary?.diskUsage ?? 0) >= 90) return { error: `Replica disk is ${server.metricsSummary.diskUsage}% full — free space before syncing` };
  if (rel.state === 'Sync Running') return { error: 'A sync is already running for this replica' };

  return {
    relationship: rel,
    params: {
      relationshipId: String(rel._id),
      kind: rel.kind,
      primaryName: primary.name,
      primaryHost: primary.network?.privateIp || primary.network?.publicIp || primary.hostname,
      lagWarnSeconds: rel.lagWarnSeconds,
    },
  };
};

/** Called when the sync job is handed to the agent. */
const markRunning = async (relationshipId) => {
  await ServerRelationship.updateOne({ _id: relationshipId }, { state: 'Sync Running', stateChangedAt: new Date() });
};

/** Called by the operation engine when a sync / recovery job finishes. */
const onSyncFinished = async (op) => {
  const rel = await ServerRelationship.findById(op.replicationId);
  if (!rel) return;
  const ok = op.status === 'Succeeded';
  rel.lastSync = {
    at: new Date(),
    type: op.operationType,
    status: ok ? 'Succeeded' : 'Failed',
    durationMs: op.executionTimeMs,
    operationId: op._id,
    detail: op.postCheck?.detail || op.error,
  };
  if (typeof op.result?.lagSeconds === 'number') rel.lastLagSeconds = op.result.lagSeconds;
  rel.state = ok ? 'Sync Verified' : 'Sync Required';
  rel.stateChangedAt = new Date();
  await rel.save();

  const replica = await Server.findById(rel.replicaServerId);
  if (!replica) return;
  if (ok) {
    await resolveAlerts(replica, 'Sync', 'sync verified');
    await resolveAlerts(replica, 'Replication Delay', `${Math.round(rel.lastLagSeconds ?? 0)}s`);
  } else {
    await openAlert(replica, {
      metric: 'Sync',
      severity: 'Critical',
      value: 'failed',
      threshold: 'sync job',
      message: `${op.operationType} of ${replica.name} failed: ${op.error || op.postCheck?.detail || 'see the operation log'}`,
    });
  }
};

/** Primary/replica view with names, health and the recovery order when both sides are down. */
const listRelationships = async (filter = {}) => {
  const rels = await ServerRelationship.find(filter).sort({ createdAt: -1 }).lean();
  const ids = rels.flatMap((r) => [r.primaryServerId, r.replicaServerId]);
  const servers = await Server.find({ _id: { $in: ids } }).select('name status agent.lastHeartbeat clientId').lean();
  const byId = (id) => servers.find((s) => s._id.equals(id));
  return rels.map((r) => {
    const primary = byId(r.primaryServerId);
    const replica = byId(r.replicaServerId);
    const primaryUp = isOnline(primary);
    const replicaUp = isOnline(replica);
    let recoveryOrder = null;
    if (!primaryUp && !replicaUp) recoveryOrder = `Both are down: recover the primary (${primary?.name}) first, then sync the replica (${replica?.name}).`;
    else if (!primaryUp) recoveryOrder = `Primary ${primary?.name} is down: recover it first; the replica cannot catch up until then.`;
    return {
      ...r,
      primary: primary && { _id: primary._id, name: primary.name, status: primary.status, online: primaryUp },
      replica: replica && { _id: replica._id, name: replica.name, status: replica.status, online: replicaUp },
      recoveryOrder,
    };
  });
};

module.exports = { checksForAgent, recordChecks, prepareSync, markRunning, onSyncFinished, listRelationships, evaluate };
