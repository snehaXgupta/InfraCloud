/**
 * Simulated provider for demos and tests. Behaves like a cloud API without touching a real
 * account: every server in the inventory appears as an instance (id "sim-<serverId>", same IP),
 * snapshots take a few seconds, and a resize puts the instance into "resizing" for ~15 seconds
 * (a reboot) before it comes back on the new plan.
 *
 * State is in memory: restarting the API forgets in-flight resizes (the job is then failed safely).
 */
const Server = require('../../models/Server');
const { getPlans } = require('../planCatalog');

const SNAPSHOT_MS = Number(process.env.SIM_SNAPSHOT_MS || 4000);
const RESIZE_MS = Number(process.env.SIM_RESIZE_MS || 15000);

const instances = new Map(); // id → instance state
const snapshots = new Map(); // id → { completeAt }

const fromServer = (s) => ({
  id: `sim-${s._id}`,
  label: s.name,
  ip: s.network?.publicIp,
  region: s.region,
  plan: s.instanceType,
  vcpu: s.compute?.vcpu,
  ramGb: s.compute?.ramGb,
  diskGb: s.storage?.diskTotalGb,
  os: s.os,
  flavor: s.provider, // which provider's plan list this instance uses
  state: 'running',
  ready: true,
});

const current = async (id) => {
  let inst = instances.get(id);
  if (!inst) {
    const server = await Server.findById(String(id).replace(/^sim-/, '')).lean();
    if (!server) throw new Error(`Simulated instance ${id} not found`);
    inst = fromServer(server);
    instances.set(id, inst);
  }
  if (inst.state === 'resizing' && Date.now() >= inst.readyAt) {
    Object.assign(inst, inst.pendingPlan, { state: 'running', ready: true, pendingPlan: null });
  }
  return inst;
};

const createSimulatedAdapter = () => ({
  name: 'Simulated',
  supportsDowngrade: true,
  downtime: 'Simulated reboot, about 15 seconds',

  verify: async () => ({ account: 'Simulated provider (no real account)' }),
  listInstances: async () => {
    const servers = await Server.find().lean();
    return Promise.all(servers.map((s) => current(`sim-${s._id}`)));
  },
  getInstance: async (id) => {
    const { pendingPlan, readyAt, ...inst } = await current(id);
    return inst;
  },
  listPlans: async () => null, // nothing to sync: uses the built-in price list
  listUpgradePlans: async (id) => {
    const inst = await current(id);
    return getPlans(inst.flavor).plans.filter((p) => p.type !== inst.plan && p.priceMonthly > 0);
  },
  createSnapshot: async (id) => {
    await current(id);
    const snapId = `sim-snap-${Date.now()}`;
    snapshots.set(snapId, { completeAt: Date.now() + SNAPSHOT_MS });
    return snapId;
  },
  getSnapshotStatus: async (snapId) => {
    const snap = snapshots.get(snapId);
    if (!snap) return 'failed';
    return Date.now() >= snap.completeAt ? 'complete' : 'pending';
  },
  resizeInstance: async (id, planType) => {
    const inst = await current(id);
    const plan = getPlans(inst.flavor).plans.find((p) => p.type === planType);
    if (!plan) throw new Error(`Plan ${planType} is not available for this instance`);
    inst.state = 'resizing';
    inst.ready = false;
    inst.readyAt = Date.now() + RESIZE_MS;
    inst.pendingPlan = { plan: plan.type, vcpu: plan.vcpu, ramGb: plan.ramGb, diskGb: plan.diskGb };
  },
});

module.exports = { createSimulatedAdapter };
