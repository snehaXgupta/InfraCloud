const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Server = require('../models/Server');
const ServerRelationship = require('../models/ServerRelationship');
const { listRelationships } = require('../services/replicationService');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { clientFilter, canAccessClient } = require('../middleware/scope');
const { logAudit } = require('../services/auditService');

router.use(protect);

/**
 * @desc    Primary → replica relationships with state, lag and recovery order (§9)
 * @route   GET /api/replication
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await listRelationships(clientFilter(req)) });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Declare a replica of a primary
 * @route   POST /api/replication  { primaryServerId, replicaServerId, kind, lagWarnSeconds?, lagCritSeconds? }
 * @access  Platform Admin, DevOps (both servers in scope and in the same client)
 */
router.post('/', authorize(R.ADMIN, R.DEVOPS), async (req, res, next) => {
  try {
    const { primaryServerId, replicaServerId, kind, lagWarnSeconds = 60, lagCritSeconds = 300 } = req.body;
    if (![primaryServerId, replicaServerId].every(mongoose.isValidObjectId) || primaryServerId === replicaServerId) {
      return res.status(400).json({ success: false, error: 'Choose two different servers' });
    }
    if (!['postgres', 'mysql'].includes(kind)) return res.status(400).json({ success: false, error: 'kind must be postgres or mysql' });
    if (!(lagWarnSeconds > 0 && lagCritSeconds > lagWarnSeconds)) {
      return res.status(400).json({ success: false, error: 'Critical lag must be greater than warning lag' });
    }
    const [primary, replica] = await Promise.all([Server.findById(primaryServerId), Server.findById(replicaServerId)]);
    if (!primary || !replica || !canAccessClient(req.user, primary.clientId) || !canAccessClient(req.user, replica.clientId)) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    if (String(primary.clientId) !== String(replica.clientId)) {
      return res.status(400).json({ success: false, error: 'Primary and replica must belong to the same client' });
    }
    if (await ServerRelationship.exists({ replicaServerId: primary._id })) {
      return res.status(400).json({ success: false, error: `${primary.name} is itself a replica — chained replicas are not supported` });
    }
    if (await ServerRelationship.exists({ replicaServerId: replica._id })) {
      return res.status(409).json({ success: false, error: `${replica.name} is already a replica of another server` });
    }

    const rel = await ServerRelationship.create({
      clientId: primary.clientId,
      primaryServerId: primary._id,
      replicaServerId: replica._id,
      kind,
      lagWarnSeconds,
      lagCritSeconds,
      createdBy: req.user._id,
    });
    await logAudit({
      req,
      action: 'REPLICATION_CREATED',
      resourceType: 'Server',
      resourceId: replica._id,
      resourceName: `${primary.name} → ${replica.name}`,
      details: { kind, lagWarnSeconds, lagCritSeconds },
    });
    res.status(201).json({ success: true, data: rel });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Remove a relationship (servers are untouched)
 * @route   DELETE /api/replication/:id
 */
router.delete('/:id', authorize(R.ADMIN, R.DEVOPS), async (req, res, next) => {
  try {
    const rel = mongoose.isValidObjectId(req.params.id) ? await ServerRelationship.findById(req.params.id) : null;
    if (!rel || !canAccessClient(req.user, rel.clientId)) return res.status(404).json({ success: false, error: 'Not found' });
    await rel.deleteOne();
    await logAudit({ req, action: 'REPLICATION_DELETED', resourceType: 'Server', resourceId: rel.replicaServerId, resourceName: String(rel._id) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
