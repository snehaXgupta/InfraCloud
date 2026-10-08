/**
 * Builds the resize plan for a server: current plan and price, real utilisation, candidate
 * plans with cost difference, recommendation, approval and execution rules.
 * Shared by the planning endpoint and request creation (so a request is validated against the
 * same candidates the user saw).
 */
const Integration = require('../models/Integration');
const ResizeRequest = require('../models/ResizeRequest');
const { getAdapter } = require('./providers');
const { getPlans, findPlan } = require('./planCatalog');
const { rateFor, CURRENCY } = require('./costService');
const { getUtilization } = require('./prometheusService');
const { getDowntimeRequirements, recommend } = require('./resizeService');
const { ENABLE_RESIZE_EXECUTION } = require('../config/env');

const ACTIVE_STATUSES = ['pending_approval', 'queued', 'running'];

const loadAdapter = async (server) => {
  if (!server.providerRef?.integrationId || !server.providerRef?.instanceId) return null;
  const integration = await Integration.findById(server.providerRef.integrationId).select('+credentials');
  if (!integration) return null;
  return { integration, adapter: getAdapter(integration), instanceId: server.providerRef.instanceId };
};

/** @param server Server document with environmentId populated */
const buildResizePlan = async (server) => {
  const rate = rateFor(server);
  const known = findPlan(server.provider, server.instanceType);
  const current = {
    type: server.instanceType,
    vcpu: server.compute?.vcpu ?? known?.plan.vcpu,
    ramGb: server.compute?.ramGb ?? known?.plan.ramGb,
    diskGb: server.storage?.diskTotalGb ?? known?.plan.diskGb,
    priceMonthly: rate.monthlyRate,
    priceSource: rate.source,
  };

  let utilization = null;
  try {
    utilization = await getUtilization(server._id, 7);
  } catch {
    utilization = null;
  }

  const link = await loadAdapter(server);
  let candidates;
  let warning = null;
  let downtime;
  let supportsDowngrade = true;
  if (link) {
    supportsDowngrade = link.adapter.supportsDowngrade;
    downtime = link.adapter.downtime;
    try {
      candidates = await link.adapter.listUpgradePlans(link.instanceId);
    } catch (err) {
      warning = `Could not load sizes from ${link.integration.provider}: ${err.message}`;
      candidates = [];
    }
  } else {
    candidates = getPlans(server.provider).plans.filter((p) => p.type !== server.instanceType);
    downtime = getDowntimeRequirements(server.provider).downtimeExpected;
  }

  const rec = recommend(utilization, current, candidates, supportsDowngrade);

  let notExecutableReason = null;
  if (!link) notExecutableReason = 'Link this server to a provider account (Integrations) to resize it from the panel. Until then this is a plan only.';
  else if (link.integration.provider !== 'Simulated' && !ENABLE_RESIZE_EXECUTION)
    notExecutableReason = `Resize execution for ${link.integration.provider} is switched off (ENABLE_RESIZE_EXECUTION).`;

  const activeRequest = await ResizeRequest.findOne({ serverId: server._id, status: { $in: ACTIVE_STATUSES } })
    .select('status toPlan createdAt')
    .lean();

  const environmentType = server.environmentId?.type || null;

  return {
    server: { id: server._id, name: server.name, provider: server.provider, region: server.region, environmentType },
    current,
    currency: server.cost?.currency || CURRENCY,
    utilization,
    recommendation: rec,
    candidates: candidates
      .map((p) => ({
        ...p,
        monthlyCostDelta: Math.round((p.priceMonthly - (current.priceMonthly || 0)) * 100) / 100,
        recommended: p.type === rec.planType,
      }))
      .sort((a, b) => a.priceMonthly - b.priceMonthly),
    link: link
      ? { integrationId: link.integration._id, integrationName: link.integration.name, provider: link.integration.provider, instanceId: link.instanceId }
      : null,
    supportsDowngrade,
    downtime,
    requiresApproval: environmentType === 'Production',
    executable: !notExecutableReason && !warning,
    notExecutableReason: notExecutableReason || warning,
    activeRequest,
  };
};

module.exports = { buildResizePlan, loadAdapter, ACTIVE_STATUSES };
