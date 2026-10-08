const mongoose = require('mongoose');
const Server = require('../models/Server');
const costService = require('../services/costService');
const { clientFilter } = require('../middleware/scope');
const { logAudit } = require('../services/auditService');

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const currentMonth = () => costService.dayKey(new Date()).slice(0, 7);

const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null);

// @desc    Cost summary by client / project / provider / server for a month
// @route   GET /api/costs/summary?month=YYYY-MM&clientId=&projectId=
// @access  Private (scoped)
const getCostSummary = async (req, res, next) => {
  try {
    const month = req.query.month || currentMonth();
    if (!MONTH.test(month)) return res.status(400).json({ success: false, error: 'month must be YYYY-MM' });

    const match = { ...clientFilter(req) };
    for (const key of ['clientId', 'projectId']) {
      if (!req.query[key]) continue;
      const id = toObjectId(req.query[key]);
      if (!id) return res.status(400).json({ success: false, error: `Invalid ${key}` });
      // A scoped user asking for a client outside their scope gets an empty result
      match[key] = key === 'clientId' && match.clientId && !match.clientId.$in.some((a) => a.equals(id)) ? { $in: [] } : id;
    }

    const data = await costService.summary(month, match);
    res.json({ success: true, data: { ...data, lastIngest: costService.getLastIngest() } });
  } catch (error) {
    next(error);
  }
};

// @desc    Cost of a single project (discovery doc §16: GET /projects/:id/cost)
// @route   GET /api/projects/:id/cost
// @access  Private (scoped via requireScope on the route)
const getProjectCost = async (req, res, next) => {
  req.query.projectId = req.params.id;
  return getCostSummary(req, res, next);
};

// @desc    Cost detail for one server
// @route   GET /api/costs/servers/:id?month=YYYY-MM
// @access  Private (scoped)
const getServerCost = async (req, res, next) => {
  try {
    const month = req.query.month || currentMonth();
    if (!MONTH.test(month)) return res.status(400).json({ success: false, error: 'month must be YYYY-MM' });
    const server = await Server.findById(req.params.id).lean();
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    res.json({ success: true, data: await costService.serverCost(server, month) });
  } catch (error) {
    next(error);
  }
};

// @desc    Set (or clear with null) a server's monthly rate; overrides catalog estimates
// @route   PUT /api/costs/servers/:id/rate
// @access  Platform Admin, Billing / Finance
const setServerRate = async (req, res, next) => {
  try {
    const { monthlyRate } = req.body;
    if (monthlyRate !== null && !(typeof monthlyRate === 'number' && monthlyRate >= 0 && monthlyRate < 1e7)) {
      return res.status(400).json({ success: false, error: 'monthlyRate must be a non-negative number or null' });
    }
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const previousRate = server.cost?.monthlyRate ?? null;
    if (monthlyRate === null) {
      server.cost = undefined;
    } else {
      server.cost = { monthlyRate, currency: costService.CURRENCY, updatedAt: new Date() };
    }
    await server.save();
    await costService.ingest({ _id: server._id }); // re-accrue today at the new rate

    await logAudit({
      req,
      action: 'COST_RATE_SET',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      details: { previousRate, monthlyRate, currency: costService.CURRENCY },
    });

    res.json({ success: true, data: costService.rateFor(server) });
  } catch (error) {
    next(error);
  }
};

// @desc    Import provider invoice amounts as Actuals for a month
// @route   POST /api/costs/actuals  { month, lines: [{ server, amount }] }
// @access  Platform Admin, Billing / Finance
const importActuals = async (req, res, next) => {
  try {
    const { month, lines } = req.body;
    if (!MONTH.test(month || '') || month > currentMonth()) {
      return res.status(400).json({ success: false, error: 'month must be YYYY-MM and not in the future' });
    }
    if (!Array.isArray(lines) || !lines.length || lines.length > 5000) {
      return res.status(400).json({ success: false, error: 'lines must be a non-empty list of { server, amount }' });
    }

    const result = await costService.importActuals({ month, lines, user: req.user, serverScope: clientFilter(req) });

    await logAudit({
      req,
      action: 'COST_ACTUALS_IMPORT',
      resourceType: 'System',
      resourceName: `Invoice ${month}`,
      status: result.unmatched.length ? 'Warning' : 'Success',
      details: { month, imported: result.imported, unmatched: result.unmatched.slice(0, 50) },
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Run cost ingestion now (normally hourly)
// @route   POST /api/costs/refresh
// @access  Platform Admin, Billing / Finance
const refreshCosts = async (req, res, next) => {
  try {
    const result = await costService.ingest(clientFilter(req));
    await logAudit({ req, action: 'COST_REFRESH', resourceType: 'System', resourceName: 'Cost ingestion', details: result });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCostSummary, getProjectCost, getServerCost, setServerRate, importActuals, refreshCosts };
