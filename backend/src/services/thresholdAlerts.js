/**
 * Threshold alerting for agent heartbeats (discovery doc §7.5 defaults).
 *
 * - A breach must persist for the rule's duration before an alert opens (debounce).
 * - One open alert per server + metric: no duplicate emails while an incident continues.
 * - When the metric recovers, open alerts auto-resolve and a recovery email is sent.
 * - Missing heartbeats mark live-agent servers offline and raise a Critical alert.
 *
 * Breach start times are held in memory, so a restart restarts the debounce window.
 */
const Alert = require('../models/Alert');
const Server = require('../models/Server');
const { sendAlertEmail } = require('./emailService');
const { logAudit } = require('./auditService');

// ALERT_DURATION_SCALE shortens every duration for demos/tests (e.g. 0.05 → 10 min becomes 30 s).
const scale = Number(process.env.ALERT_DURATION_SCALE || 1);

const RULES = {
  CPU: { warning: 85, critical: 95, warningFor: 600, criticalFor: 600 },
  Memory: { warning: 85, critical: 95, warningFor: 600, criticalFor: 300 },
  Disk: { warning: 80, critical: 90, warningFor: 0, criticalFor: 0 },
};

const HEARTBEAT_GRACE_SECONDS = Number(process.env.HEARTBEAT_GRACE_SECONDS || 180);

const breachStarts = new Map(); // `${serverId}:${metric}:${severity}` → ms

const severityFor = (rule, value) =>
  value > rule.critical ? 'Critical' : value > rule.warning ? 'Warning' : null;

const notify = (server, alert, recovered = false) =>
  sendAlertEmail({
    serverName: server.name,
    ip: server.network?.publicIp,
    severity: recovered ? 'Info' : alert.severity,
    metric: alert.metric,
    currentValue: alert.currentValue,
    threshold: alert.threshold,
    message: recovered ? `RECOVERED: ${alert.message}` : alert.message,
  }).catch((err) => console.error('[Alert Email Error]', err.message));

const openAlert = async (server, { metric, severity, value, threshold, message }) => {
  const existing = await Alert.findOne({ serverId: server._id, metric, status: { $ne: 'resolved' } });

  if (existing) {
    // Escalate Warning → Critical in place; otherwise keep the single open incident.
    if (existing.severity === 'Warning' && severity === 'Critical') {
      existing.severity = 'Critical';
      existing.currentValue = String(value);
      existing.threshold = threshold;
      existing.message = message;
      await existing.save();
      notify(server, existing);
    }
    return existing;
  }

  const alert = await Alert.create({
    serverId: server._id,
    clientId: server.clientId,
    projectId: server.projectId,
    environmentId: server.environmentId,
    severity,
    metric,
    currentValue: String(value),
    threshold,
    message,
  });
  notify(server, alert);
  await logAudit({
    action: 'ALERT_OPEN',
    resourceType: 'Alert',
    resourceId: alert._id,
    resourceName: `${server.name} ${metric}`,
    details: { severity, value, threshold },
  });
  return alert;
};

const resolveAlerts = async (server, metric, value) => {
  const open = await Alert.find({ serverId: server._id, metric, status: { $ne: 'resolved' } });
  for (const alert of open) {
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.currentValue = String(value);
    await alert.save();
    notify(server, alert, true);
    await logAudit({
      action: 'ALERT_AUTO_RESOLVE',
      resourceType: 'Alert',
      resourceId: alert._id,
      resourceName: `${server.name} ${metric}`,
      details: { value },
    });
  }
};

/** Evaluate one heartbeat sample. @returns {'healthy'|'warning'|'critical'} */
const evaluateSample = async (server, values) => {
  let worst = 'healthy';
  const now = Date.now();

  for (const [metric, rule] of Object.entries(RULES)) {
    const value = values[metric];
    if (typeof value !== 'number') continue;
    const severity = severityFor(rule, value);

    if (severity === 'Critical') worst = 'critical';
    else if (severity === 'Warning' && worst !== 'critical') worst = 'warning';

    for (const level of ['Warning', 'Critical']) {
      const key = `${server._id}:${metric}:${level}`;
      const breached = level === 'Critical' ? severity === 'Critical' : severity !== null;
      if (!breached) {
        breachStarts.delete(key);
        continue;
      }
      if (!breachStarts.has(key)) breachStarts.set(key, now);
    }

    if (!severity) {
      await resolveAlerts(server, metric, `${value}%`);
      continue;
    }

    // Highest level whose breach has lasted its full duration (Critical may not be sustained yet
    // while the Warning-level breach already is).
    const sustained = (level) =>
      (now - breachStarts.get(`${server._id}:${metric}:${level}`)) / 1000 >=
      (level === 'Critical' ? rule.criticalFor : rule.warningFor) * scale;
    const level = severity === 'Critical' && sustained('Critical') ? 'Critical' : sustained('Warning') ? 'Warning' : null;

    if (level) {
      const forSeconds = (level === 'Critical' ? rule.criticalFor : rule.warningFor) * scale;
      const limit = level === 'Critical' ? rule.critical : rule.warning;
      const minutes = Math.round(forSeconds / 60);
      await openAlert(server, {
        metric,
        severity: level,
        value: `${value}%`,
        threshold: `>${limit}%${forSeconds ? ` for ${minutes ? `${minutes}m` : `${Math.round(forSeconds)}s`}` : ''}`,
        message: `${metric} at ${value}% on ${server.name} (${server.hostname}) exceeded ${limit}%${forSeconds ? ` for ${minutes ? `${minutes} min` : `${Math.round(forSeconds)} s`}` : ''}.`,
      });
    }
  }

  // Heartbeat is back: clear any missing-heartbeat incident.
  await resolveAlerts(server, 'Heartbeat', 'online');
  return worst;
};

/** Periodic sweep: live agents that stopped reporting go offline with a Critical alert. */
const sweepMissingHeartbeats = async () => {
  const cutoff = new Date(Date.now() - HEARTBEAT_GRACE_SECONDS * 1000);
  const silent = await Server.find({
    'agent.isLiveAgent': true,
    'agent.lastHeartbeat': { $lt: cutoff },
    status: { $nin: ['offline', 'maintenance'] },
  });

  for (const server of silent) {
    server.status = 'offline';
    server.agent.status = 'unreachable';
    await server.save();
    await openAlert(server, {
      metric: 'Heartbeat',
      severity: 'Critical',
      value: `last seen ${server.agent.lastHeartbeat.toISOString()}`,
      threshold: `${HEARTBEAT_GRACE_SECONDS}s grace`,
      message: `No heartbeat from ${server.name} (${server.hostname}) for over ${Math.round(HEARTBEAT_GRACE_SECONDS / 60)} min.`,
    });
  }
};

const startHeartbeatSweeper = () => {
  const timer = setInterval(() => {
    sweepMissingHeartbeats().catch((err) => console.error('[Heartbeat Sweep Error]', err.message));
  }, 30 * 1000);
  timer.unref();
};

module.exports = { evaluateSample, sweepMissingHeartbeats, startHeartbeatSweeper, RULES };
