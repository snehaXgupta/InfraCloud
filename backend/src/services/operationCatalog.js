/**
 * Operation catalog (discovery doc §8, §20): every operation a user can run on a server.
 *
 * The panel only ever sends an operation KEY plus validated parameters to the agent. The script
 * that runs is built into the agent itself (telemetry/infra-agent.js), so no command text ever
 * travels over the network. Each entry declares its risk, approval rule and time limit.
 *
 * approval: 'never' | 'production' (production environments need a second person) | 'always'
 * verify:   how success is confirmed after the agent reports
 *           'agent'   → the agent's own post-check result
 *           'reboot'  → the server's boot time changes and the heartbeat comes back
 *           'version' → the agent's heartbeat reports the new version
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_NAME = /^[a-zA-Z0-9@._-]{1,64}$/;
const AGENT_PATH = path.resolve(__dirname, '../../../telemetry/infra-agent.js');

const agentRelease = () => {
  const source = fs.readFileSync(AGENT_PATH);
  const version = (source.toString().match(/const AGENT_VERSION = '([^']+)'/) || [])[1] || 'unknown';
  return { version, sha256: crypto.createHash('sha256').update(source).digest('hex') };
};

const CATALOG = {
  'Health Check': {
    key: 'health-check',
    description: 'Read-only check: CPU, memory, disk, inodes, load and failed services.',
    risk: 'low',
    approval: 'never',
    timeoutSec: 60,
    verify: 'agent',
    validate: () => ({ params: {} }),
  },
  'Service Restart': {
    key: 'service-restart',
    description: 'Restart one service from this server’s allow-list, then confirm it is running.',
    risk: 'medium',
    approval: 'production',
    timeoutSec: 120,
    verify: 'agent',
    validate: (server, params) => {
      const service = String(params.service || '');
      if (!SERVICE_NAME.test(service)) return { error: 'Choose a valid service name' };
      if (!(server.allowedServices || []).includes(service)) {
        return { error: `"${service}" is not on this server's allowed services list (edit the server to add it)` };
      }
      return { params: { service } };
    },
  },
  Cleanup: {
    key: 'cleanup',
    description: 'Free disk space: old journal logs (>7 days), package cache, temp files older than 7 days.',
    risk: 'medium',
    approval: 'production',
    timeoutSec: 300,
    verify: 'agent',
    validate: (server, params) => ({ params: { dryRun: params.dryRun !== false } }),
  },
  'Agent Update': {
    key: 'agent-update',
    description: 'Install the panel’s current agent version (checksum verified), then restart the agent.',
    risk: 'low',
    approval: 'never',
    timeoutSec: 180,
    verify: 'version',
    validate: () => ({ params: agentRelease() }),
  },
  Reboot: {
    key: 'reboot',
    description: 'Reboot the server in 1 minute; succeeds when it comes back and reports again.',
    risk: 'high',
    approval: 'always',
    confirmName: true,
    timeoutSec: 900,
    verify: 'reboot',
    validate: () => ({ params: {} }),
  },
  Sync: {
    key: 'replica-sync',
    description: 'Bring a replica back in line with its primary using the server’s approved sync script.',
    risk: 'high',
    approval: 'always',
    confirmName: true,
    timeoutSec: 1800,
    verify: 'agent',
    replication: true,
  },
  'Replica Recovery': {
    key: 'replica-recovery',
    description: 'Rebuild a broken replica from its primary using the server’s approved recovery script.',
    risk: 'high',
    approval: 'always',
    confirmName: true,
    timeoutSec: 3600,
    verify: 'agent',
    replication: true,
  },
};

const OPERATION_TYPES = Object.keys(CATALOG);

/** Public view of the catalog for the UI */
const describeCatalog = () =>
  OPERATION_TYPES.map((type) => {
    const { key, description, risk, approval, confirmName, timeoutSec, replication } = CATALOG[type];
    return { type, key, description, risk, approval, confirmName: !!confirmName, timeoutSec, replication: !!replication };
  });

const needsApproval = (entry, environmentType) =>
  entry.approval === 'always' || (entry.approval === 'production' && environmentType === 'Production');

module.exports = { CATALOG, OPERATION_TYPES, describeCatalog, needsApproval, agentRelease };
