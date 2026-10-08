const mongoose = require('mongoose');
const Integration = require('../models/Integration');
const Server = require('../models/Server');
const { seal } = require('../services/secretBox');
const { getAdapter, PROVIDERS } = require('../services/providers');
const { savePlans } = require('../services/planCatalog');
const costService = require('../services/costService');
const { clientFilter, canAccessClient } = require('../middleware/scope');
const { logAudit } = require('../services/auditService');

const PLAN_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const scopedFilter = (req) => {
  const f = clientFilter(req);
  // Unowned integrations (no clientId) are visible to global roles only
  return f.clientId ? { clientId: f.clientId } : {};
};

const loadIntegration = async (req, res) => {
  const integration = mongoose.isValidObjectId(req.params.id) ? await Integration.findById(req.params.id) : null;
  if (!integration || (integration.clientId ? !canAccessClient(req.user, integration.clientId) : !canAccessClient(req.user, null))) {
    res.status(404).json({ success: false, error: 'Integration not found' });
    return null;
  }
  return integration;
};

const verify = async (integration) => {
  try {
    const info = await getAdapter(integration).verify();
    Object.assign(integration, { status: 'connected', lastError: undefined, lastCheckedAt: new Date() });
    await integration.save();
    return { ok: true, ...info };
  } catch (err) {
    Object.assign(integration, { status: 'error', lastError: err.message.slice(0, 300), lastCheckedAt: new Date() });
    await integration.save();
    return { ok: false, error: err.message };
  }
};

/** Pull the provider's plan list and prices into the catalog, then re-accrue today's costs. */
const syncPlans = async (integration) => {
  const plans = await getAdapter(integration).listPlans();
  if (!plans) return 0;
  const count = await savePlans(integration.provider, plans);
  await costService.ingest({ provider: integration.provider });
  return count;
};

// @route GET /api/integrations
const listIntegrations = async (req, res, next) => {
  try {
    const integrations = await Integration.find(scopedFilter(req)).populate('clientId', 'name').sort({ createdAt: -1 }).lean();
    const counts = await Server.aggregate([
      { $match: { 'providerRef.integrationId': { $in: integrations.map((i) => i._id) } } },
      { $group: { _id: '$providerRef.integrationId', n: { $sum: 1 } } },
    ]);
    const data = integrations.map(({ credentials, ...i }) => ({
      ...i,
      linkedServers: counts.find((c) => c._id.equals(i._id))?.n || 0,
    }));
    res.json({ success: true, data, providers: PROVIDERS });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/integrations  { name, provider, apiKey?, clientId? }
const createIntegration = async (req, res, next) => {
  try {
    const { name, provider, apiKey, clientId } = req.body;
    if (!name || !PROVIDERS.includes(provider)) {
      return res.status(400).json({ success: false, error: `name and provider (${PROVIDERS.join(' / ')}) are required` });
    }
    if (provider !== 'Simulated' && (!apiKey || String(apiKey).trim().length < 10)) {
      return res.status(400).json({ success: false, error: `An API key is required for ${provider}` });
    }
    if (clientId && !mongoose.isValidObjectId(clientId)) return res.status(400).json({ success: false, error: 'Invalid clientId' });

    const key = provider === 'Simulated' ? 'simulated' : String(apiKey).trim();
    const integration = await Integration.create({
      name: String(name).trim().slice(0, 80),
      provider,
      clientId: clientId || undefined,
      credentials: seal(key),
      keyHint: provider === 'Simulated' ? undefined : key.slice(-4),
      createdBy: req.user._id,
    });
    const check = await verify(integration);
    let plansSynced = 0;
    if (check.ok) plansSynced = await syncPlans(integration).catch(() => 0);

    await logAudit({
      req,
      action: 'INTEGRATION_CREATED',
      resourceType: 'System',
      resourceId: integration._id,
      resourceName: `${provider}: ${integration.name}`,
      status: check.ok ? 'Success' : 'Warning',
      details: { provider, verified: check.ok, error: check.error, plansSynced },
    });
    res.status(201).json({ success: true, data: integration, check, plansSynced });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/integrations/:id/test
const testIntegration = async (req, res, next) => {
  try {
    const integration = await loadIntegration(req, res);
    if (!integration) return;
    res.json({ success: true, data: await verify(integration) });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/integrations/:id/sync-plans
const syncIntegrationPlans = async (req, res, next) => {
  try {
    const integration = await loadIntegration(req, res);
    if (!integration) return;
    const count = await syncPlans(integration);
    await logAudit({ req, action: 'PLANS_SYNCED', resourceType: 'System', resourceName: integration.name, details: { count } });
    res.json({ success: true, data: { plansSynced: count } });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
};

// @route GET /api/integrations/:id/instances — provider instances with suggested server matches (by IP)
const listInstances = async (req, res, next) => {
  try {
    const integration = await loadIntegration(req, res);
    if (!integration) return;
    let instances;
    try {
      instances = await getAdapter(integration).listInstances();
    } catch (err) {
      return res.status(502).json({ success: false, error: err.message });
    }
    const servers = await Server.find(clientFilter(req)).select('name network.publicIp providerRef provider').lean();
    const data = instances.map((inst) => {
      const linked = servers.find((s) => s.providerRef?.instanceId === inst.id && String(s.providerRef?.integrationId) === String(integration._id));
      const byIp = servers.find((s) => inst.ip && s.network?.publicIp === inst.ip);
      return { ...inst, linkedServerId: linked?._id || null, suggestedServerId: linked ? null : byIp?._id || null };
    });
    res.json({ success: true, data, servers: servers.map((s) => ({ _id: s._id, name: s.name, ip: s.network?.publicIp })) });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/integrations/:id/link  { links: [{ instanceId, serverId|null }] }
const linkServers = async (req, res, next) => {
  try {
    const integration = await loadIntegration(req, res);
    if (!integration) return;
    const links = Array.isArray(req.body.links) ? req.body.links : [];
    let linked = 0;
    let unlinked = 0;
    for (const { instanceId, serverId } of links) {
      if (!instanceId) continue;
      // Clear this instance from any server it was linked to
      const cleared = await Server.updateMany(
        { 'providerRef.integrationId': integration._id, 'providerRef.instanceId': instanceId, ...clientFilter(req) },
        { $unset: { providerRef: 1 } }
      );
      unlinked += cleared.modifiedCount;
      if (serverId && mongoose.isValidObjectId(serverId)) {
        const r = await Server.updateOne(
          { _id: serverId, ...clientFilter(req) },
          { providerRef: { integrationId: integration._id, instanceId: String(instanceId), linkedAt: new Date() } }
        );
        linked += r.modifiedCount;
      }
    }
    await logAudit({ req, action: 'SERVERS_LINKED', resourceType: 'System', resourceName: integration.name, details: { linked, unlinked } });
    res.json({ success: true, data: { linked, unlinked } });
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/integrations/:id — removes the stored key and unlinks its servers
const deleteIntegration = async (req, res, next) => {
  try {
    const integration = await loadIntegration(req, res);
    if (!integration) return;
    const r = await Server.updateMany({ 'providerRef.integrationId': integration._id }, { $unset: { providerRef: 1 } });
    await integration.deleteOne();
    await logAudit({ req, action: 'INTEGRATION_DELETED', resourceType: 'System', resourceName: integration.name, details: { unlinkedServers: r.modifiedCount } });
    res.json({ success: true, data: { unlinkedServers: r.modifiedCount } });
  } catch (error) {
    next(error);
  }
};

/** Daily price sync for every connected integration that has a price API. */
const startPlanSync = () => {
  const run = async () => {
    const integrations = await Integration.find({ status: 'connected', provider: { $ne: 'Simulated' } });
    for (const integration of integrations) {
      await syncPlans(integration).catch((err) => console.error(`[Plan Sync] ${integration.name}: ${err.message}`));
    }
  };
  setInterval(() => run().catch(() => {}), PLAN_SYNC_INTERVAL_MS).unref();
};

module.exports = {
  listIntegrations,
  createIntegration,
  testIntegration,
  syncIntegrationPlans,
  listInstances,
  linkServers,
  deleteIntegration,
  startPlanSync,
};
