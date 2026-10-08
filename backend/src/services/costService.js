/**
 * Cost management (discovery doc §11).
 *
 * - Ingestion is scheduled (hourly) and writes CostSnapshot rows; pages only read snapshots,
 *   never a billing API.
 * - Every figure is labelled: Estimated (accrued from the server's monthly rate), Actual
 *   (imported provider invoice) or Forecast (month-end projection).
 * - Rate precedence per server: manual rate set by Billing → exact plan price (synced from the
 *   provider API when available, else the built-in list) →
 *   closest plan by vCPU/RAM for that provider → unpriced (0).
 */
const CostSnapshot = require('../models/CostSnapshot');
const Server = require('../models/Server');
const Client = require('../models/Client');
const Project = require('../models/Project');
const { getPlans, findPlan } = require('./planCatalog');

const CURRENCY = process.env.COST_CURRENCY || 'USD';
const TIMEZONE = process.env.COST_TIMEZONE || 'UTC';
const INGEST_INTERVAL_MS = 60 * 60 * 1000;

let lastIngest = null; // { at, servers, month }

// ── Dates in the billing timezone ────────────────────────────────────────────
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (date) => dayFormatter.format(date); // YYYY-MM-DD
const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const lastDayOf = (month) => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
const daysBetween = (fromKey, toKey) => {
  const out = [];
  const d = new Date(`${fromKey}T00:00:00Z`);
  const end = new Date(`${toKey}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};
const previousMonths = (month, count) => {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
};
const round2 = (n) => Math.round(n * 100) / 100;

// ── Rates ────────────────────────────────────────────────────────────────────
const rateFor = (server) => {
  if (typeof server.cost?.monthlyRate === 'number') {
    return { monthlyRate: server.cost.monthlyRate, source: 'manual-rate' };
  }
  const { plans: catalog } = getPlans(server.provider);
  const exact = findPlan(server.provider, server.instanceType);
  if (exact && exact.plan.priceMonthly > 0) return { monthlyRate: exact.plan.priceMonthly, source: exact.source };

  const vcpu = server.compute?.vcpu;
  const ram = server.compute?.ramGb;
  const priced = catalog.filter((p) => p.priceMonthly > 0);
  if (priced.length && vcpu > 0 && ram > 0) {
    const nearest = priced.reduce((best, p) => {
      const dist = Math.abs(Math.log(p.vcpu / vcpu)) + Math.abs(Math.log(p.ramGb / ram));
      return dist < best.dist ? { p, dist } : best;
    }, { p: null, dist: Infinity }).p;
    // Scale the nearest plan by the average resource ratio
    const scale = (vcpu / nearest.vcpu + ram / nearest.ramGb) / 2;
    return { monthlyRate: round2(nearest.priceMonthly * scale), source: 'size-match' };
  }
  return { monthlyRate: 0, source: 'unpriced' };
};

// ── Ingestion ────────────────────────────────────────────────────────────────
/**
 * Accrue today's estimated cost for each server (re-written on every run so rate changes apply
 * today) and backfill missing earlier days of the current month (never overwritten).
 */
const ingest = async (serverFilter = {}) => {
  const now = new Date();
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const dim = daysInMonth(month);
  const servers = await Server.find(serverFilter).lean();

  const existing = await CostSnapshot.aggregate([
    { $match: { month, kind: 'estimated', serverId: { $in: servers.map((s) => s._id) } } },
    { $group: { _id: '$serverId', dates: { $addToSet: '$date' } } },
  ]);
  const haveDates = new Map(existing.map((e) => [e._id.toString(), new Set(e.dates)]));

  const ops = [];
  for (const server of servers) {
    const { monthlyRate, source } = rateFor(server);
    const createdKey = dayKey(server.createdAt || now);
    const firstDay = createdKey > `${month}-01` ? createdKey : `${month}-01`;
    const have = haveDates.get(server._id.toString()) || new Set();

    for (const date of daysBetween(firstDay, today)) {
      if (date !== today && have.has(date)) continue;
      const doc = {
        clientId: server.clientId,
        projectId: server.projectId,
        environmentId: server.environmentId,
        provider: server.provider,
        instanceType: server.instanceType,
        month,
        amount: round2(monthlyRate / dim),
        monthlyRate,
        currency: server.cost?.currency || CURRENCY,
        source,
        capturedAt: now,
      };
      ops.push({
        updateOne: {
          filter: { serverId: server._id, kind: 'estimated', date },
          update: date === today ? { $set: doc } : { $setOnInsert: doc },
          upsert: true,
        },
      });
    }
  }

  if (ops.length) await CostSnapshot.bulkWrite(ops, { ordered: false });
  lastIngest = { at: now, servers: servers.length, month };
  return { ...lastIngest, writes: ops.length };
};

const startCostIngestion = () => {
  const run = () => ingest().catch((err) => console.error('[Cost Ingestion Error]', err.message));
  setTimeout(run, 10 * 1000).unref();
  setInterval(run, INGEST_INTERVAL_MS).unref();
};

// ── Reporting ────────────────────────────────────────────────────────────────
const labelFor = (hasActual, hasEstimate) => (hasActual && hasEstimate ? 'Mixed' : hasActual ? 'Actual' : 'Estimated');

/**
 * @param {string} month YYYY-MM
 * @param {object} match extra CostSnapshot filter (tenant scope, clientId/projectId)
 */
const summary = async (month, match = {}) => {
  const today = dayKey(new Date());
  const currentMonth = today.slice(0, 7);
  const isCurrentMonth = month === currentMonth;
  const dim = daysInMonth(month);
  const remainingDays = isCurrentMonth ? dim - Number(today.slice(8, 10)) : 0;

  const [perServer, daily, historyRows, lastCaptured] = await Promise.all([
    CostSnapshot.aggregate([
      { $match: { month, ...match } },
      { $sort: { date: 1 } },
      {
        $group: {
          _id: { serverId: '$serverId', kind: '$kind' },
          amount: { $sum: '$amount' },
          monthlyRate: { $last: '$monthlyRate' },
          source: { $last: '$source' },
          clientId: { $last: '$clientId' },
          projectId: { $last: '$projectId' },
          provider: { $last: '$provider' },
          instanceType: { $last: '$instanceType' },
        },
      },
    ]),
    CostSnapshot.aggregate([
      { $match: { month, kind: 'estimated', ...match } },
      { $group: { _id: '$date', amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    CostSnapshot.aggregate([
      { $match: { month: { $in: previousMonths(month, 6) }, ...match } },
      { $group: { _id: { month: '$month', serverId: '$serverId', kind: '$kind' }, amount: { $sum: '$amount' } } },
    ]),
    CostSnapshot.findOne({ month, ...match }).sort({ capturedAt: -1 }).select('capturedAt').lean(),
  ]);

  // Merge estimated + actual per server; actual wins
  const servers = new Map();
  for (const row of perServer) {
    const id = row._id.serverId.toString();
    const entry = servers.get(id) || { id, estimated: null, actual: null };
    entry[row._id.kind] = row;
    servers.set(id, entry);
  }

  const [serverDocs, clientDocs, projectDocs] = await Promise.all([
    Server.find({ _id: { $in: [...servers.keys()] } }).select('name hostname').lean(),
    Client.find({ _id: { $in: perServer.map((r) => r.clientId).filter(Boolean) } }).select('name').lean(),
    Project.find({ _id: { $in: perServer.map((r) => r.projectId).filter(Boolean) } }).select('name').lean(),
  ]);
  const nameOf = (docs, id) => docs.find((d) => d._id.toString() === String(id))?.name || 'Unassigned';

  const serverRows = [...servers.values()].map(({ id, estimated, actual }) => {
    const base = actual || estimated;
    const amount = actual ? actual.amount : estimated.amount;
    const dailyRate = estimated ? (estimated.monthlyRate || 0) / dim : 0;
    return {
      id,
      name: nameOf(serverDocs, id),
      clientId: base.clientId,
      projectId: base.projectId,
      provider: base.provider,
      instanceType: base.instanceType,
      monthlyRate: estimated?.monthlyRate ?? null,
      rateSource: estimated?.source ?? 'invoice',
      estimated: estimated ? round2(estimated.amount) : null,
      actual: actual ? round2(actual.amount) : null,
      amount: round2(amount),
      forecast: round2(actual ? actual.amount : amount + dailyRate * remainingDays),
      label: actual ? 'Actual' : 'Estimated',
    };
  });

  const groupBy = (keyFn, nameFn) => {
    const groups = new Map();
    for (const s of serverRows) {
      const key = String(keyFn(s) || 'none');
      const g = groups.get(key) || { id: key, name: nameFn(key), amount: 0, forecast: 0, servers: 0, hasActual: false, hasEstimate: false };
      g.amount += s.amount;
      g.forecast += s.forecast;
      g.servers += 1;
      g.hasActual ||= s.label === 'Actual';
      g.hasEstimate ||= s.label === 'Estimated';
      groups.set(key, g);
    }
    return [...groups.values()]
      .map(({ hasActual, hasEstimate, ...g }) => ({ ...g, amount: round2(g.amount), forecast: round2(g.forecast), label: labelFor(hasActual, hasEstimate) }))
      .sort((a, b) => b.amount - a.amount);
  };

  // History: per month, actual replaces estimate per server
  const byMonth = new Map();
  for (const r of historyRows) {
    const m = byMonth.get(r._id.month) || new Map();
    const s = m.get(r._id.serverId.toString()) || {};
    s[r._id.kind] = r.amount;
    m.set(r._id.serverId.toString(), s);
    byMonth.set(r._id.month, m);
  }
  const history = previousMonths(month, 6).map((m) => {
    const rows = [...(byMonth.get(m)?.values() || [])];
    const hasActual = rows.some((r) => r.actual != null);
    const hasEstimate = rows.some((r) => r.actual == null);
    return {
      month: m,
      amount: round2(rows.reduce((sum, r) => sum + (r.actual ?? r.estimated ?? 0), 0)),
      label: rows.length ? labelFor(hasActual, hasEstimate) : null,
    };
  });

  const total = serverRows.reduce((sum, s) => sum + s.amount, 0);
  return {
    month,
    currency: CURRENCY,
    timezone: TIMEZONE,
    isCurrentMonth,
    daysInMonth: dim,
    daysElapsed: isCurrentMonth ? Number(today.slice(8, 10)) : dim,
    lastSyncedAt: lastCaptured?.capturedAt || null,
    totals: {
      amount: round2(total),
      label: labelFor(serverRows.some((s) => s.label === 'Actual'), serverRows.some((s) => s.label === 'Estimated')),
      forecast: round2(serverRows.reduce((sum, s) => sum + s.forecast, 0)),
    },
    byClient: groupBy((s) => s.clientId, (id) => nameOf(clientDocs, id)),
    byProject: groupBy((s) => s.projectId, (id) => nameOf(projectDocs, id)),
    byProvider: groupBy((s) => s.provider, (id) => id),
    servers: serverRows.sort((a, b) => b.amount - a.amount),
    daily: daily.map((d) => ({ date: d._id, amount: round2(d.amount) })),
    history,
  };
};

/** Cost detail for one server: current rate plus the month summary and history. */
const serverCost = async (server, month) => {
  const rate = rateFor(server);
  const report = await summary(month, { serverId: server._id });
  return {
    currency: server.cost?.currency || CURRENCY,
    monthlyRate: rate.monthlyRate,
    rateSource: rate.source,
    rateUpdatedAt: server.cost?.updatedAt || null,
    month: report.month,
    isCurrentMonth: report.isCurrentMonth,
    lastSyncedAt: report.lastSyncedAt,
    amount: report.totals.amount,
    label: report.totals.label,
    forecast: report.totals.forecast,
    daily: report.daily,
    history: report.history,
  };
};

/**
 * Import invoice totals as Actuals for a month.
 * @param {Array<{server: string, amount: number}>} lines server = id, hostname or name
 * @param {object} serverScope Server filter restricting which servers may be written
 */
const importActuals = async ({ month, currency = CURRENCY, lines, user, serverScope = {} }) => {
  const servers = await Server.find(serverScope).lean();
  const find = (ref) => {
    const key = String(ref || '').trim().toLowerCase();
    return servers.find(
      (s) => s._id.toString() === key || s.hostname?.toLowerCase() === key || s.name?.toLowerCase() === key
    );
  };

  const ops = [];
  const unmatched = [];
  for (const line of lines) {
    const server = find(line.server);
    const amount = Number(line.amount);
    if (!server || !Number.isFinite(amount) || amount < 0) {
      unmatched.push(line.server);
      continue;
    }
    ops.push({
      updateOne: {
        filter: { serverId: server._id, kind: 'actual', date: lastDayOf(month) },
        update: {
          $set: {
            clientId: server.clientId,
            projectId: server.projectId,
            environmentId: server.environmentId,
            provider: server.provider,
            instanceType: server.instanceType,
            month,
            amount: round2(amount),
            currency,
            source: 'invoice',
            capturedAt: new Date(),
            importedBy: user?._id,
          },
        },
        upsert: true,
      },
    });
  }
  if (ops.length) await CostSnapshot.bulkWrite(ops, { ordered: false });
  return { imported: ops.length, unmatched };
};

module.exports = {
  CURRENCY,
  TIMEZONE,
  dayKey,
  rateFor,
  ingest,
  startCostIngestion,
  summary,
  serverCost,
  importActuals,
  getLastIngest: () => lastIngest,
};
