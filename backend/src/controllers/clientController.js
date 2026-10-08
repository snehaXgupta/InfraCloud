const Client = require('../models/Client');
const Project = require('../models/Project');
const Server = require('../models/Server');
const { logAudit } = require('../services/auditService');
const { clientFilter } = require('../middleware/scope');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
const getClients = async (req, res, next) => {
  try {
    const clients = await Client.find(clientFilter(req, '_id')).sort({ createdAt: -1 });

    // Attach project and server counts
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const projectCount = await Project.countDocuments({ clientId: client._id });
        const serverCount = await Server.countDocuments({ clientId: client._id });
        const healthyServers = await Server.countDocuments({ clientId: client._id, status: 'healthy' });

        return {
          ...client.toObject(),
          projectCount,
          serverCount,
          healthyServers,
        };
      })
    );

    res.json({
      success: true,
      count: clientsWithStats.length,
      data: clientsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const projects = await Project.find({ clientId: client._id }).sort({ createdAt: -1 });
    const servers = await Server.find({ clientId: client._id })
      .populate('environmentId', 'name type')
      .populate('projectId', 'name');

    res.json({
      success: true,
      data: {
        ...client.toObject(),
        projects,
        servers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
const createClient = async (req, res, next) => {
  try {
    const { name, description, status, contactEmail, tier, sla } = req.body;

    const client = await Client.create({
      name,
      description,
      status: status || 'active',
      contactEmail,
      tier: tier || 'Enterprise',
      sla: sla || '99.95% High Availability',
    });

    await logAudit({
      req,
      action: 'CLIENT_CREATE',
      resourceType: 'Client',
      resourceId: client._id,
      resourceName: client.name,
      status: 'Success',
      details: { tier: client.tier, contactEmail: client.contactEmail },
    });

    res.status(201).json({
      success: true,
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
const updateClient = async (req, res, next) => {
  try {
    let client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await logAudit({
      req,
      action: 'CLIENT_UPDATE',
      resourceType: 'Client',
      resourceId: client._id,
      resourceName: client.name,
      status: 'Success',
      details: req.body,
    });

    res.json({
      success: true,
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // Check if client has servers attached
    const serverCount = await Server.countDocuments({ clientId: client._id });
    if (serverCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete client with ${serverCount} active servers. Please de-provision or reassign servers first.`,
      });
    }

    await client.deleteOne();

    await logAudit({
      req,
      action: 'CLIENT_DELETE',
      resourceType: 'Client',
      resourceId: client._id,
      resourceName: client.name,
      status: 'Success',
    });

    res.json({
      success: true,
      data: {},
      message: 'Client deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
