const Environment = require('../models/Environment');
const Server = require('../models/Server');
const { logAudit } = require('../services/auditService');
const Project = require('../models/Project');
const { clientFilter, isGlobal } = require('../middleware/scope');

// @desc    Get environments
// @route   GET /api/environments
// @access  Private
const getEnvironments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.projectId) {
      filter.projectId = req.query.projectId;
    }

    const scope = isGlobal(req.user)
      ? {}
      : { projectId: { $in: await Project.find(clientFilter(req)).distinct('_id') } };

    const environments = await Environment.find({ $and: [filter, scope] })
      .populate({
        path: 'projectId',
        select: 'name clientId',
        populate: { path: 'clientId', select: 'name' },
      })
      .sort({ createdAt: -1 });

    const envsWithCounts = await Promise.all(
      environments.map(async (env) => {
        const serverCount = await Server.countDocuments({ environmentId: env._id });
        return {
          ...env.toObject(),
          serverCount,
        };
      })
    );

    res.json({
      success: true,
      count: envsWithCounts.length,
      data: envsWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single environment
// @route   GET /api/environments/:id
// @access  Private
const getEnvironmentById = async (req, res, next) => {
  try {
    const env = await Environment.findById(req.params.id).populate({
      path: 'projectId',
      populate: { path: 'clientId', select: 'name' },
    });

    if (!env) {
      return res.status(404).json({ success: false, error: 'Environment not found' });
    }

    const servers = await Server.find({ environmentId: env._id });

    res.json({
      success: true,
      data: {
        ...env.toObject(),
        servers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create environment
// @route   POST /api/environments
// @access  Private
const createEnvironment = async (req, res, next) => {
  try {
    const { projectId, name, type, status, clusterUrl } = req.body;

    const env = await Environment.create({
      projectId,
      name,
      type,
      status: status || 'healthy',
      clusterUrl,
    });

    await logAudit({
      req,
      action: 'ENVIRONMENT_CREATE',
      resourceType: 'Environment',
      resourceId: env._id,
      resourceName: env.name,
      status: 'Success',
      details: { type: env.type, projectId },
    });

    res.status(201).json({
      success: true,
      data: env,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEnvironments,
  getEnvironmentById,
  createEnvironment,
};
