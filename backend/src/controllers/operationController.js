const Operation = require('../models/Operation');
const Server = require('../models/Server');
const { CATALOG, describeCatalog, needsApproval } = require('../services/operationCatalog');
const { prepareSync } = require('../services/replicationService');
const { logAudit } = require('../services/auditService');
const { serverFilter } = require('../middleware/scope');
const { ROLES: R } = require('../middleware/auth');

const APPROVAL_TTL_MS = 72 * 60 * 60 * 1000;
const AGENT_ONLINE_MS = 90 * 1000;
const APPROVER_ROLES = [R.ADMIN, R.DEVOPS];
const ACTIVE = ['Awaiting Approval', 'Queued', 'Dispatched', 'Running', 'Verifying'];

const populate = (q) =>
  q.populate('serverId', 'name hostname provider status network environmentId').populate('requestedBy', 'name email role');

// @desc    Operations (scoped) + the catalog
// @route   GET /api/operations?serverId=&status=&operationType=
// @access  Private
const getOperations = async (req, res, next) => {
  try {
    const { serverId, status, operationType } = req.query;
    const query = {};

    if (serverId) query.serverId = serverId;
    if (status === 'active') query.status = { $in: ACTIVE };
    else if (status && status !== 'all') query.status = status;
    if (operationType && operationType !== 'all') query.operationType = operationType;

    const operations = await populate(Operation.find({ $and: [query, await serverFilter(req)] }).sort({ createdAt: -1 }).limit(300));

    res.json({
      success: true,
      count: operations.length,
      data: operations,
      catalog: describeCatalog(),
      approvedCatalog: Object.keys(CATALOG),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Operation catalog (risk, approval, confirmation rules)
// @route   GET /api/operations/catalog
const getCatalog = (req, res) => res.json({ success: true, data: describeCatalog() });

// @desc    Get single operation (with live output)
// @route   GET /api/operations/:id
// @access  Private (scoped)
const getOperationById = async (req, res, next) => {
  try {
    const operation = await populate(Operation.findById(req.params.id));
    if (!operation) {
      return res.status(404).json({ success: false, error: 'Operation record not found' });
    }
    res.json({ success: true, data: operation });
  } catch (error) {
    next(error);
  }
};

// @desc    Request an operation from the catalog. Runs on the server through its agent,
//          after approval when the catalog requires it (§8.1).
// @route   POST /api/operations  { serverId, operationType, parameters, reason, confirmName, scheduledFor }
// @access  Platform Admin, DevOps, Project Admin (scoped)
const createOperation = async (req, res, next) => {
  try {
    const { serverId, operationType, parameters = {}, reason, confirmName, scheduledFor } = req.body;

    // Arbitrary commands are never accepted (§8: no unrestricted shell)
    if (req.body.command || req.body.shell || req.body.script) {
      await logAudit({
        req,
        action: 'SECURITY_ALERT_ARBITRARY_SHELL_BLOCKED',
        resourceType: 'Operation',
        resourceName: 'Arbitrary Shell Execution Attempt',
        status: 'Failed',
        details: { blockedInput: String(req.body.command || req.body.shell || req.body.script).slice(0, 200) },
      });
      return res.status(400).json({
        success: false,
        error: 'Arbitrary shell execution is forbidden. You must select an approved operation from the catalog.',
      });
    }

    const entry = CATALOG[operationType];
    if (!entry) {
      return res.status(400).json({
        success: false,
        error: `Invalid operation type '${operationType}'. Approved operations: ${Object.keys(CATALOG).join(', ')}`,
      });
    }

    const server = await Server.findById(serverId).populate('environmentId', 'type');
    if (!server) return res.status(404).json({ success: false, error: 'Target server not found' });

    const online = server.agent?.lastHeartbeat && Date.now() - new Date(server.agent.lastHeartbeat) < AGENT_ONLINE_MS;
    if (!online) {
      return res.status(409).json({ success: false, error: 'No agent is reporting from this server. Connect it first (server → Agent).' });
    }
    if (!(server.agent?.capabilities || []).includes('jobs')) {
      return res.status(409).json({
        success: false,
        error: 'The agent on this server is too old to run operations. Re-run the install command from server → Agent to update it.',
      });
    }

    if (entry.confirmName && String(confirmName || '').trim() !== server.name) {
      return res.status(400).json({ success: false, error: `Type the server name exactly ("${server.name}") to confirm` });
    }

    let params;
    let replicationId;
    if (entry.replication) {
      const prepared = await prepareSync(server, parameters);
      if (prepared.error) return res.status(400).json({ success: false, error: prepared.error });
      params = prepared.params;
      replicationId = prepared.relationship._id;
      const busy = await Operation.findOne({ replicationId, status: { $in: ACTIVE } }).select('operationType status');
      if (busy) return res.status(409).json({ success: false, error: `${busy.operationType} for this replica is already ${busy.status.toLowerCase()}` });
    } else {
      const v = entry.validate(server, parameters);
      if (v.error) return res.status(400).json({ success: false, error: v.error });
      params = v.params;
    }

    const environmentType = server.environmentId?.type || null;
    const requiresApproval = needsApproval(entry, environmentType);
    if (requiresApproval && (!reason || String(reason).trim().length < 5)) {
      return res.status(400).json({ success: false, error: 'This operation needs approval — give a reason (at least 5 characters)' });
    }

    let runAfter = new Date();
    if (scheduledFor) {
      runAfter = new Date(scheduledFor);
      if (Number.isNaN(runAfter.getTime()) || runAfter > new Date(Date.now() + 30 * 86400000)) {
        return res.status(400).json({ success: false, error: 'scheduledFor must be a date within the next 30 days' });
      }
    }

    const operation = await Operation.create({
      serverId: server._id,
      clientId: server.clientId,
      serverName: server.name,
      environmentType,
      operationType,
      catalogKey: entry.key,
      requestedBy: req.user._id,
      reason: reason ? String(reason).trim().slice(0, 500) : undefined,
      parameters: params,
      replicationId,
      requiresApproval,
      approvalExpiresAt: requiresApproval ? new Date(Date.now() + APPROVAL_TTL_MS) : undefined,
      status: requiresApproval ? 'Awaiting Approval' : 'Queued',
      queuedAt: requiresApproval ? undefined : new Date(),
      runAfter,
    });

    await logAudit({
      req,
      action: 'OPERATION_REQUESTED',
      resourceType: 'Operation',
      resourceId: operation._id,
      resourceName: `${operationType} on ${server.name}`,
      details: { serverName: server.name, operationType, parameters: params, requiresApproval },
    });

    res.status(201).json({ success: true, data: await populate(Operation.findById(operation._id)) });
  } catch (error) {
    next(error);
  }
};

const decide = (decision) => async (req, res, next) => {
  try {
    if (!APPROVER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only Platform Admin or DevOps can approve or reject operations' });
    }
    const op = await Operation.findById(req.params.id);
    if (!op) return res.status(404).json({ success: false, error: 'Operation not found' });
    if (op.status !== 'Awaiting Approval') {
      return res.status(409).json({ success: false, error: `Operation is ${op.status.toLowerCase()}, not waiting for approval` });
    }
    if (op.requestedBy.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'You cannot approve or reject your own request — a second person must decide' });
    }

    op.decisions.push({
      by: req.user._id,
      byName: req.user.name,
      decision,
      comment: String(req.body.comment || '').slice(0, 500),
      at: new Date(),
    });
    if (decision === 'approved') {
      op.status = 'Queued';
      op.queuedAt = new Date();
      if (!op.runAfter || op.runAfter < new Date()) op.runAfter = new Date();
    } else {
      op.status = 'Rejected';
      op.completedAt = new Date();
    }
    await op.save();

    await logAudit({
      req,
      action: decision === 'approved' ? 'OPERATION_APPROVED' : 'OPERATION_REJECTED',
      resourceType: 'Operation',
      resourceId: op._id,
      resourceName: `${op.operationType} on ${op.serverName}`,
      details: { comment: req.body.comment },
    });
    res.json({ success: true, data: await populate(Operation.findById(op._id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel before the agent picks it up (requester or Platform Admin)
// @route   POST /api/operations/:id/cancel
const cancelOperation = async (req, res, next) => {
  try {
    const op = await Operation.findById(req.params.id);
    if (!op) return res.status(404).json({ success: false, error: 'Operation not found' });
    if (!op.requestedBy.equals(req.user._id) && req.user.role !== R.ADMIN) {
      return res.status(403).json({ success: false, error: 'Only the requester or a Platform Admin can cancel' });
    }
    const updated = await Operation.findOneAndUpdate(
      { _id: op._id, status: { $in: ['Awaiting Approval', 'Queued'] } },
      { status: 'Cancelled', completedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(409).json({ success: false, error: 'Only operations that have not started can be cancelled' });
    await logAudit({
      req,
      action: 'OPERATION_CANCELLED',
      resourceType: 'Operation',
      resourceId: op._id,
      resourceName: `${op.operationType} on ${op.serverName}`,
    });
    res.json({ success: true, data: await populate(Operation.findById(op._id)) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOperations,
  getCatalog,
  getOperationById,
  createOperation,
  approveOperation: decide('approved'),
  rejectOperation: decide('rejected'),
  cancelOperation,
};
