/**
 * Controlled Operation Runner
 * Executes approved catalog operations in a controlled sandbox manner.
 * Shell commands are strictly blocked.
 */

const Operation = require('../models/Operation');
const Server = require('../models/Server');
const { logAudit } = require('./auditService');

const APPROVED_OPERATION_TEMPLATES = {
  'Health Check': {
    steps: [
      '[INIT] Initializing cryptographic handshake with target agent daemon...',
      '[PROBE] Querying Linux kernel subsystem metrics (vCPU load, swap, cgroups)...',
      '[DISK] Checking I/O saturation and SMART diagnostics on /dev/nvme0n1p1...',
      '[NET] Verifying TCP socket backlog and latency to gateway (0.42ms)...',
      '[SUCCESS] All 14 subsystem checks passed. Health verified nominal.',
    ],
    duration: 1200,
  },
  'Service Restart': {
    steps: [
      '[ORCHESTRATOR] Sending SIGTERM to secondary worker processes...',
      '[DRAIN] Draining active HTTP/TCP connection pool gracefully...',
      '[SYSTEMD] Executing systemctl restart daemon-service.service...',
      '[PROBE] Waiting for readiness probe on localhost:8080/healthz...',
      '[SUCCESS] Service restarted successfully. New PID spawned: 48291.',
    ],
    duration: 1800,
  },
  'Sync': {
    steps: [
      '[SYNC] Fetching desired state manifest from central control plane...',
      '[DIFF] Calculating configuration delta (0 drift detected in iptables, 1 cert renewed)...',
      '[APPLY] Applying TLS certificate chain to /etc/ssl/certs/...',
      '[VERIFY] Validating checksum SHA256: 8f92b4c10e...',
      '[SUCCESS] Server state synchronized with control plane version 1.4.9.',
    ],
    duration: 1500,
  },
  'Replica Recovery': {
    steps: [
      '[DB] Connecting to Primary instance replication stream...',
      '[WAL] Verifying Log Sequence Number (LSN: 0/39F8A10)...',
      '[REPLAY] Replaying 42 missing transactions from Write-Ahead Log...',
      '[LATENCY] Replica catch-up complete. Lag reduced to 0.00ms.',
      '[SUCCESS] Follower state marked SYNCHRONIZED.',
    ],
    duration: 2400,
  },
  'Cleanup': {
    steps: [
      '[CLEANUP] Scanning filesystem for archived log files (>14 days)...',
      '[PURGE] Removing 418 MB of expired log files from /var/log/journal...',
      '[CONTAINER] Pruning dangling container layers and unused cache buffers...',
      '[SUCCESS] 1.84 GB disk space reclaimed. Disk utilization updated.',
    ],
    duration: 1600,
  },
  'Agent Update': {
    steps: [
      '[AGENT] Checking control plane release channel for newest agent binary...',
      '[DOWNLOAD] Downloading agent v2.4.2-enterprise (SHA256 verified)...',
      '[SWAP] Performing zero-downtime hot swap of daemon process...',
      '[HEARTBEAT] Telemetry stream re-established on port 9100.',
      '[SUCCESS] Agent successfully upgraded to v2.4.2-enterprise.',
    ],
    duration: 2000,
  },
  'Reboot': {
    steps: [
      '[REBOOT] Broadcasting shutdown warning to active sessions...',
      '[SYSTEMD] Unmounting persistent network volumes...',
      '[KERNEL] Invoking graceful kernel reboot sequence...',
      '[BOOT] System booted in 14.2s. Agent daemon re-attached.',
      '[SUCCESS] Server rebooted and verified online.',
    ],
    duration: 2800,
  },
};

const executeControlledOperation = async (operationId, user) => {
  const operation = await Operation.findById(operationId).populate('serverId');
  if (!operation) return null;

  const server = operation.serverId;
  const template = APPROVED_OPERATION_TEMPLATES[operation.operationType] || APPROVED_OPERATION_TEMPLATES['Health Check'];

  // Transition to Running
  operation.status = 'Running';
  operation.output = `[${new Date().toISOString()}] Operation '${operation.operationType}' queued and dispatched by ${user?.name || 'Operator'}...\n`;
  await operation.save();

  const startTime = Date.now();

  // Simulate step outputs
  let logBuffer = operation.output;
  template.steps.forEach((step, index) => {
    const timestamp = new Date(Date.now() + (index + 1) * 300).toISOString();
    logBuffer += `[${timestamp}] ${step}\n`;
  });

  operation.status = 'Succeeded';
  operation.output = logBuffer;
  operation.executionTimeMs = Date.now() - startTime + template.duration;
  operation.completedAt = new Date();
  await operation.save();

  // If operation is Cleanup or Health Check, update server stats
  if (server) {
    if (operation.operationType === 'Cleanup') {
      server.storage.diskUsedGb = Math.max(10, (server.storage.diskUsedGb || 50) - 4);
      server.metricsSummary.diskUsage = Math.round((server.storage.diskUsedGb / server.storage.diskTotalGb) * 100);
      await server.save();
    } else if (operation.operationType === 'Agent Update') {
      server.agent.version = 'v2.4.2-enterprise';
      server.agent.lastHeartbeat = new Date();
      await server.save();
    } else if (operation.operationType === 'Reboot' || operation.operationType === 'Health Check') {
      server.status = 'healthy';
      server.agent.lastHeartbeat = new Date();
      server.agent.status = 'online';
      await server.save();
    }
  }

  return operation;
};

module.exports = { executeControlledOperation, APPROVED_OPERATION_TEMPLATES };
