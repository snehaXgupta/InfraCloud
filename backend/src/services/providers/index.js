/**
 * Provider adapter registry. Every adapter implements:
 *   verify(), listInstances(), getInstance(id), listPlans(), listUpgradePlans(id),
 *   createSnapshot(id, description), getSnapshotStatus(snapshotId), resizeInstance(id, planType)
 * plus { name, supportsDowngrade, downtime }.
 */
const { open } = require('../secretBox');
const { createVultrAdapter } = require('./vultr');
const { createSimulatedAdapter } = require('./simulated');

const PROVIDERS = ['Vultr', 'Simulated'];

/** @param {import('mongoose').Document} integration (with credentials selected) */
const getAdapter = (integration) => {
  switch (integration.provider) {
    case 'Vultr':
      return createVultrAdapter(open(integration.credentials));
    case 'Simulated':
      return createSimulatedAdapter();
    default:
      throw new Error(`Unsupported provider: ${integration.provider}`);
  }
};

module.exports = { PROVIDERS, getAdapter };
