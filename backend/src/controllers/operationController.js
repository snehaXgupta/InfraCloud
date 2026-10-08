const Operation = require('../models/Operation');
const Server = require('../models/Server');
const { executeControlledOperation, APPROVED_OPERATION_TEMPLATES } = require('../services/operationRunner');
const { logAudit } = require('../services/auditService');
const { serverFilter } = require('../middleware/scope');

// @desc    Get all operations
// @route   GET /api/operations
// @access  Private
const getOperations = async (req, res, next) => {
  try {
    const { serverId, status, operationType } = req.query;
    const query = {};

    if (serverId) query.serverId = serverId;
    if (status && status !== 'all') query.status = status;
    if (operationType && operationType !== 'all') query.operationType = operationType;

    const operations = await Operation.find({ $and: [query, await serverFilter(req)] })
      .populate('serverId', 'name hostname provider status network')
      .populate('requestedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: operations.length,
      data: operations,
      approvedCatalog: Object.keys(APPROVED_OPERATION_TEMPLATES),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single operation
// @route   GET /api/operations/:id
// @access  Private
const getOperationById = async (req, res, next) => {
  try {
    const operation = await Operation.findById(req.params.id)
      .populate('serverId')
      .populate('requestedBy', 'name email role');

    if (!operation) {
      return res.status(404).json({ success: false, error: 'Operation record not found' });
    }

    res.json({
      success: true,
      data: operation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Dispatch an approved operation
// @route   POST /api/operations
// @access  Private
const createOperation = async (req, res, next) => {
  try {
    const { serverId, operationType, parameters } = req.body;

    // Strict validation: Reject arbitrary shell/commands
    if (req.body.command || req.body.shell || req.body.script) {
      await logAudit({
        req,
        action: 'SECURITY_ALERT_ARBITRARY_SHELL_BLOCKED',
        resourceType: 'Operation',
        resourceName: 'Arbitrary Shell Execution Attempt',
        status: 'Failed',
        details: { blockedInput: req.body.command || req.body.shell },
      });

      return res.status(400).json({
        success: false,
        error: 'Arbitrary shell execution is forbidden. You must select an approved operation from the catalog.',
      });
    }

    const approvedTypes = Object.keys(APPROVED_OPERATION_TEMPLATES);
    if (!approvedTypes.includes(operationType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid operation type '${operationType}'. Approved operations: ${approvedTypes.join(', ')}`,
      });
    }

    const server = await Server.findById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Target server not found' });
    }

    // Per-server lock (discovery doc §20): no two operations (e.g. sync + resize) at once.
    // Atomic claim on the server document; locks older than LOCK_STALE_MS (crashed runner) can be taken over.
    const LOCK_STALE_MS = 30 * 60 * 1000;
    const locked = await Server.findOneAndUpdate(
      {
        _id: serverId,
        $or: [{ operationLock: null }, { 'operationLock.at': { $lt: new Date(Date.now() - LOCK_STALE_MS) } }],
      },
      { $set: { operationLock: { type: operationType, by: req.user._id, at: new Date() } } },
      { new: true }
    );
    if (!locked) {
      const current = (await Server.findById(serverId).select('operationLock').lean())?.operationLock;
      return res.status(409).json({
        success: false,
        error: `${current?.type || 'Another operation'} is already running on this server. Wait for it to finish.`,
      });
    }

    // Always release the server lock, even if creating or running the operation fails
    let completedOperation;
    try {
      const operation = await Operation.create({
        serverId,
        operationType,
        requestedBy: req.user._id,
        status: 'Pending',
        parameters: parameters || {},
      });

      await logAudit({
        req,
        action: 'OPERATION_DISPATCHED',
        resourceType: 'Operation',
        resourceId: operation._id,
        resourceName: `${operationType} on ${server.name}`,
        status: 'Success',
        details: { serverName: server.name, operationType },
      });

      // Execute through controlled sandbox runner
      completedOperation = await executeControlledOperation(operation._id, req.user);
    } finally {
      await Server.updateOne({ _id: serverId }, { $set: { operationLock: null } });
    }

    const populatedOp = await Operation.findById(completedOperation._id)
      .populate('serverId', 'name hostname provider status network')
      .populate('requestedBy', 'name email role');

    res.status(201).json({
      success: true,
      data: populatedOp,
      message: `Operation '${operationType}' executed successfully`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOperations,
  getOperationById,
  createOperation,
};
