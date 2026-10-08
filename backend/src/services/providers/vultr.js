/**
 * Vultr API v2 adapter (https://www.vultr.com/api/).
 * Authenticated with the client's API key (Bearer). All calls are server-side only.
 */
const BASE = 'https://api.vultr.com/v2';
const PLANS_CACHE_MS = 60 * 60 * 1000;

const createVultrAdapter = (apiKey) => {
  let plansCache = null; // { at, plans }

  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`Vultr API ${method} ${path} → ${res.status}: ${data.error || text || res.statusText}`);
    return data;
  };

  // Follows Vultr's cursor pagination
  const listAll = async (path, key) => {
    const out = [];
    let cursor = '';
    for (let page = 0; page < 50; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const data = await call('GET', `${path}${sep}per_page=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      out.push(...(data[key] || []));
      cursor = data.meta?.links?.next;
      if (!cursor) break;
    }
    return out;
  };

  const toInstance = (i) => ({
    id: i.id,
    label: i.label || i.hostname,
    ip: i.main_ip,
    region: i.region,
    plan: i.plan,
    vcpu: i.vcpu_count,
    ramGb: Math.round((i.ram / 1024) * 10) / 10,
    diskGb: i.disk,
    os: i.os,
    // Ready means the resize (or boot) has fully finished
    state: i.status === 'resizing' ? 'resizing' : i.power_status === 'running' ? 'running' : i.power_status || i.status,
    ready: i.status === 'active' && i.power_status === 'running' && i.server_status === 'ok',
  });

  const toPlan = (p) => ({
    type: p.id,
    vcpu: p.vcpu_count,
    ramGb: Math.round((p.ram / 1024) * 10) / 10,
    diskGb: p.disk,
    priceMonthly: p.monthly_cost,
    family: p.type,
  });

  const listPlans = async () => {
    if (plansCache && Date.now() - plansCache.at < PLANS_CACHE_MS) return plansCache.plans;
    const plans = (await listAll('/plans', 'plans')).map(toPlan);
    plansCache = { at: Date.now(), plans };
    return plans;
  };

  return {
    name: 'Vultr',
    supportsDowngrade: false,
    downtime: 'Automatic reboot, usually 1–3 minutes',

    verify: async () => {
      const { account } = await call('GET', '/account');
      return { account: account?.email || account?.name || 'Vultr account' };
    },
    listInstances: async () => (await listAll('/instances', 'instances')).map(toInstance),
    getInstance: async (id) => toInstance((await call('GET', `/instances/${encodeURIComponent(id)}`)).instance),
    listPlans,
    listUpgradePlans: async (id) => {
      const { upgrades } = await call('GET', `/instances/${encodeURIComponent(id)}/upgrades?type=plans`);
      const allowed = new Set(upgrades?.plans || []);
      return (await listPlans()).filter((p) => allowed.has(p.type));
    },
    createSnapshot: async (id, description) =>
      (await call('POST', '/snapshots', { instance_id: id, description })).snapshot.id,
    getSnapshotStatus: async (snapshotId) => {
      const { snapshot } = await call('GET', `/snapshots/${encodeURIComponent(snapshotId)}`);
      return snapshot.status === 'complete' ? 'complete' : snapshot.status === 'pending' ? 'pending' : 'failed';
    },
    resizeInstance: async (id, planType) => {
      await call('PATCH', `/instances/${encodeURIComponent(id)}`, { plan: planType });
    },
  };
};

module.exports = { createVultrAdapter };
