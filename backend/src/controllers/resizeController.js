const Server = require('../models/Server');
const ResizeRequest = require('../models/ResizeRequest');
const { buildResizePlan, ACTIVE_STATUSES } = require('../services/resizePlanner');
const { initialSteps } = require('../services/resizeWorker');
const { clientFilter, canAccessClient, isGlobal } = require('../middleware/scope');
const { ROLES: R } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const APPROVAL_TTL_MS = 72 * 60 * 60 * 1000;
const APPROVER_ROLES = [R.ADMIN, R.DEVOPS];

const loadServer = (id) => Server.findById(id).populate('environmentId', 'name type');

const populateRequest = (q) =>
  q.populate('requestedBy', 'name email role').populate('serverId', 'name status instanceType provider');

// @desc    Resize plan: current plan, usage, candidate sizes with cost difference, rules
// @route   GET /api/servers/:id/resize-options
// @access  Private (scoped)
const getResizeOptions = async (req, res, next) => {
  try {
    const server = await loadServer(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    res.json({ success: true, data: await buildResizePlan(server) });
  } catch (error) {
    next(error);
  }
};

// @desc    Request a resize (production needs a second person's approval)
// @route   POST /api/servers/:id/resize-requests  { targetPlan, reason, scheduledFor?, takeSnapshot? }
// @access  Platform Admin, DevOps, Project Admin
const createResizeRequest = async (req, res, next) => {
  try {
    const { targetPlan, reason, scheduledFor, takeSnapshot = true } = req.body;
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Give a reason (at least 5 characters)' });
    }
    let runAfter = new Date();
    if (scheduledFor) {
      runAfter = new Date(scheduledFor);
      if (Number.isNaN(runAfter.getTime()) || runAfter < new Date(Date.now() - 60 * 1000) || runAfter > new Date(Date.now() + 30 * 86400000)) {
        return res.status(400).json({ success: false, error: 'scheduledFor must be a date within the next 30 days' });
      }
    }

    const server = await loadServer(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const plan = await buildResizePlan(server);
    if (plan.activeRequest) {
      return res.status(409).json({ success: false, error: `This server already has a resize request (${plan.activeRequest.status.replace('_', ' ')})` });
    }
    if (!plan.executable) return res.status(400).json({ success: false, error: plan.notExecutableReason });
    const target = plan.candidates.find((c) => c.type === targetPlan);
    if (!target) return res.status(400).json({ success: false, error: `${targetPlan} is not an available size for this server` });

    const request = await ResizeRequest.create({
      serverId: server._id,
      clientId: server.clientId,
      serverName: server.name,
      environmentType: plan.server.environmentType,
      provider: plan.link.provider,
      integrationId: plan.link.integrationId,
      instanceId: plan.link.instanceId,
      fromPlan: plan.current,
      toPlan: { type: target.type, vcpu: target.vcpu, ramGb: target.ramGb, diskGb: target.diskGb, priceMonthly: target.priceMonthly },
      currency: plan.currency,
      monthlyCostDelta: target.monthlyCostDelta,
      downtime: plan.downtime,
      reason: String(reason).trim().slice(0, 500),
      takeSnapshot: takeSnapshot !== false,
      scheduledFor: scheduledFor ? runAfter : undefined,
      requestedBy: req.user._id,
      requiresApproval: plan.requiresApproval,
      expiresAt: plan.requiresApproval ? new Date(Date.now() + APPROVAL_TTL_MS) : undefined,
      status: plan.requiresApproval ? 'pending_approval' : 'queued',
      runAfter,
      steps: initialSteps(),
    });

    await logAudit({
      req,
      action: 'RESIZE_REQUESTED',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      details: {
        requestId: request._id.toString(),
        from: plan.current.type,
        to: target.type,
        monthlyCostDelta: target.monthlyCostDelta,
        requiresApproval: plan.requiresApproval,
      },
    });

    res.status(201).json({ success: true, data: await populateRequest(ResizeRequest.findById(request._id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Resize requests (scoped)
// @route   GET /api/resize-requests?status=active|recent|all|<status>&serverId=
// @access  Private
const listResizeRequests = async (req, res, next) => {
  try {
    const filter = { ...clientFilter(req) };
    if (req.query.status === 'active') filter.status = { $in: ACTIVE_STATUSES };
    // Active plus anything finished in the last 24 h, so a just-completed resize stays visible
    else if (req.query.status === 'recent') {
      filter.$or = [{ status: { $in: ACTIVE_STATUSES } }, { finishedAt: { $gte: new Date(Date.now() - 86400000) } }];
    }
    else if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.serverId) filter.serverId = req.query.serverId;

    const requests = await populateRequest(ResizeRequest.find(filter).sort({ createdAt: -1 }).limit(200));
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

const loadScopedRequest = async (req, res) => {
  const request = await ResizeRequest.findById(req.params.id).catch(() => null);
  if (!request || !canAccessClient(req.user, request.clientId)) {
    res.status(404).json({ success: false, error: 'Resize request not found' });
    return null;
  }
  return request;
};

// @route   GET /api/resize-requests/:id
const getResizeRequest = async (req, res, next) => {
  try {
    const request = await loadScopedRequest(req, res);
    if (!request) return;
    res.json({ success: true, data: await populateRequest(ResizeRequest.findById(request._id)) });
  } catch (error) {
    next(error);
  }
};

const decide = (decision) => async (req, res, next) => {
  try {
    if (!APPROVER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only Platform Admin or DevOps can approve or reject resizes' });
    }
    const request = await loadScopedRequest(req, res);
    if (!request) return;
    if (request.status !== 'pending_approval') {
      return res.status(409).json({ success: false, error: `Request is ${request.status.replace('_', ' ')}, not waiting for approval` });
    }
    if (request.requestedBy.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'You cannot approve or reject your own request — a second person must decide' });
    }

    request.decisions.push({
      by: req.user._id,
      byName: req.user.name,
      decision,
      comment: String(req.body.comment || '').slice(0, 500),
      at: new Date(),
    });
    if (decision === 'approved') {
      request.status = 'queued';
      request.runAfter = request.scheduledFor && request.scheduledFor > new Date() ? request.scheduledFor : new Date();
    } else {
      request.status = 'rejected';
      request.finishedAt = new Date();
    }
    await request.save();

    await logAudit({
      req,
      action: decision === 'approved' ? 'RESIZE_APPROVED' : 'RESIZE_REJECTED',
      resourceType: 'Server',
      resourceId: request.serverId,
      resourceName: request.serverName,
      details: { requestId: request._id.toString(), to: request.toPlan.type, comment: req.body.comment },
    });

    res.json({ success: true, data: await populateRequest(ResizeRequest.findById(request._id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel before it starts (requester or Platform Admin)
// @route   POST /api/resize-requests/:id/cancel
const cancelResizeRequest = async (req, res, next) => {
  try {
    const request = await loadScopedRequest(req, res);
    if (!request) return;
    if (!request.requestedBy.equals(req.user._id) && !(isGlobal(req.user) && req.user.role === R.ADMIN)) {
      return res.status(403).json({ success: false, error: 'Only the requester or a Platform Admin can cancel' });
    }
    const updated = await ResizeRequest.findOneAndUpdate(
      { _id: request._id, status: { $in: ['pending_approval', 'queued'] } },
      { status: 'cancelled', finishedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(409).json({ success: false, error: 'Only requests that have not started can be cancelled' });

    await logAudit({
      req,
      action: 'RESIZE_CANCELLED',
      resourceType: 'Server',
      resourceId: request.serverId,
      resourceName: request.serverName,
      details: { requestId: request._id.toString() },
    });
    res.json({ success: true, data: await populateRequest(ResizeRequest.findById(request._id)) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResizeOptions,
  createResizeRequest,
  listResizeRequests,
  getResizeRequest,
  approveResizeRequest: decide('approved'),
  rejectResizeRequest: decide('rejected'),
  cancelResizeRequest,
};
