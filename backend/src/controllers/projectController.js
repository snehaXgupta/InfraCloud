const Project = require('../models/Project');
const Environment = require('../models/Environment');
const Server = require('../models/Server');
const { logAudit } = require('../services/auditService');
const { clientFilter } = require('../middleware/scope');

// @desc    Get all projects (optionally filter by clientId)
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    const projects = await Project.find({ $and: [filter, clientFilter(req)] })
      .populate('clientId', 'name tier status')
      .sort({ createdAt: -1 });

    const projectsWithCounts = await Promise.all(
      projects.map(async (p) => {
        const envCount = await Environment.countDocuments({ projectId: p._id });
        const serverCount = await Server.countDocuments({ projectId: p._id });
        return {
          ...p.toObject(),
          environmentCount: envCount,
          serverCount: serverCount,
        };
      })
    );

    res.json({
      success: true,
      count: projectsWithCounts.length,
      data: projectsWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate('clientId', 'name tier contactEmail');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const environments = await Environment.find({ projectId: project._id });
    const servers = await Server.find({ projectId: project._id }).populate('environmentId', 'name type');

    res.json({
      success: true,
      data: {
        ...project.toObject(),
        environments,
        servers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res, next) => {
  try {
    const { clientId, name, description, repositoryUrl, techStack, status, leadDevOps } = req.body;

    const project = await Project.create({
      clientId,
      name,
      description,
      repositoryUrl,
      techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(s => s.trim()) : []),
      status: status || 'active',
      leadDevOps: leadDevOps || 'Infra Core Team',
    });

    // Auto-create standard environments: Development, Staging, Production
    await Environment.create([
      { projectId: project._id, name: 'Production Cluster', type: 'Production', status: 'healthy' },
      { projectId: project._id, name: 'Staging Sandbox', type: 'Staging', status: 'healthy' },
      { projectId: project._id, name: 'Development Node', type: 'Development', status: 'healthy' },
    ]);

    await logAudit({
      req,
      action: 'PROJECT_CREATE',
      resourceType: 'Project',
      resourceId: project._id,
      resourceName: project.name,
      status: 'Success',
      details: { clientId: project.clientId },
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = async (req, res, next) => {
  try {
    let project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (req.body.techStack && typeof req.body.techStack === 'string') {
      req.body.techStack = req.body.techStack.split(',').map(s => s.trim());
    }

    project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAudit({
      req,
      action: 'PROJECT_UPDATE',
      resourceType: 'Project',
      resourceId: project._id,
      resourceName: project.name,
      status: 'Success',
      details: req.body,
    });

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const serverCount = await Server.countDocuments({ projectId: project._id });
    if (serverCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete project with ${serverCount} running servers.`,
      });
    }

    await Environment.deleteMany({ projectId: project._id });
    await project.deleteOne();

    await logAudit({
      req,
      action: 'PROJECT_DELETE',
      resourceType: 'Project',
      resourceId: project._id,
      resourceName: project.name,
      status: 'Success',
    });

    res.json({
      success: true,
      data: {},
      message: 'Project and child environments removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
};
