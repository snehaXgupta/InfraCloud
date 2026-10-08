/**
 * Plan catalog: built-in list prices (priceList.js), overridden per provider by plans synced
 * from the provider's API (PlanPrice collection). Reads are synchronous from an in-memory copy
 * that is refreshed whenever plans are synced.
 */
const PlanPrice = require('../models/PlanPrice');
const { PROVIDER_SIZES } = require('./priceList');

let synced = new Map(); // provider → plans[]
let syncedAt = new Map(); // provider → Date

const loadSyncedPlans = async () => {
  const rows = await PlanPrice.find().lean();
  const next = new Map();
  const at = new Map();
  for (const r of rows) {
    if (!next.has(r.provider)) next.set(r.provider, []);
    next.get(r.provider).push({ type: r.type, vcpu: r.vcpu, ramGb: r.ramGb, diskGb: r.diskGb, priceMonthly: r.priceMonthly, family: r.family });
    if (!at.has(r.provider) || r.syncedAt > at.get(r.provider)) at.set(r.provider, r.syncedAt);
  }
  synced = next;
  syncedAt = at;
};

/** @returns {{ plans: object[], source: 'provider-api'|'plan-catalog', syncedAt: Date|null }} */
const getPlans = (provider) =>
  synced.has(provider)
    ? { plans: synced.get(provider), source: 'provider-api', syncedAt: syncedAt.get(provider) }
    : { plans: PROVIDER_SIZES[provider] || [], source: 'plan-catalog', syncedAt: null };

const findPlan = (provider, type) => {
  const { plans, source } = getPlans(provider);
  const plan = plans.find((p) => p.type.toLowerCase() === String(type || '').toLowerCase());
  return plan ? { plan, source } : null;
};

/** Replace a provider's synced plans (from its API) and refresh the in-memory copy. */
const savePlans = async (provider, plans) => {
  const now = new Date();
  await PlanPrice.bulkWrite(
    plans.map((p) => ({
      updateOne: {
        filter: { provider, type: p.type },
        update: { $set: { ...p, provider, syncedAt: now } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  await loadSyncedPlans();
  return plans.length;
};

module.exports = { loadSyncedPlans, getPlans, findPlan, savePlans };
