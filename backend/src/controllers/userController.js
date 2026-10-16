const User = require('../models/User');
const Client = require('../models/Client');
const { getAllRolePermissions, getUserEffectivePermissions } = require('../services/rolePermissionService');

// Validates a list of client ids for scope assignment; returns null if any id is unknown.
const resolveClientIds = async (ids) => {
  if (ids === undefined) return undefined;
  if (!Array.isArray(ids)) return null;
  const unique = [...new Set(ids.map(String))];
  const found = await Client.find({ _id: { $in: unique } }).distinct('_id').catch(() => null);
  return found && found.length === unique.length ? found : null;
};
const { logAudit } = require('../services/auditService');

// @desc    Get all users with roles and effective permissions
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res, next) => {
  try {
    const roleMatrix = await getAllRolePermissions();
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });

    const enriched = users.map((u) => {
      const obj = u.toObject();
      obj.effectivePermissions = getUserEffectivePermissions(u, roleMatrix);
      return obj;
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
      roleMatrix,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role & status
// @route   PUT /api/users/:id/role
// @access  Private (Platform Admin, DevOps)
const updateUserRole = async (req, res, next) => {
  try {
    const { role, status, customPermissions } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const assignedClients = await resolveClientIds(req.body.assignedClients);
    if (assignedClients === null) {
      return res.status(400).json({ success: false, error: 'assignedClients must be a list of existing client ids' });
    }

    const previousRole = user.role;
    const previousClients = user.assignedClients.map(String);
    if (role) user.role = role;
    if (status) user.status = status;
    if (assignedClients) user.assignedClients = assignedClients;
    if (customPermissions !== undefined) {
      user.customPermissions = customPermissions;
    }

    await user.save();

    const roleMatrix = await getAllRolePermissions();
    const enriched = user.toObject();
    enriched.effectivePermissions = getUserEffectivePermissions(user, roleMatrix);

    await logAudit({
      req,
      action: 'USER_ROLE_UPDATED',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      status: 'Success',
      details: {
        previousRole,
        newRole: user.role,
        status: user.status,
        previousClients,
        assignedClients: user.assignedClients.map(String),
        customPermissions: user.customPermissions,
      },
    });

    res.json({
      success: true,
      data: enriched,
      message: 'User role and permissions updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, customPermissions } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    const assignedClients = await resolveClientIds(req.body.assignedClients);
    if (assignedClients === null) {
      return res.status(400).json({ success: false, error: 'assignedClients must be a list of existing client ids' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: role || 'Client Viewer',
      assignedClients: assignedClients || [],
      customPermissions: customPermissions || {},
    });

    const roleMatrix = await getAllRolePermissions();
    const enriched = user.toObject();
    enriched.effectivePermissions = getUserEffectivePermissions(user, roleMatrix);

    await logAudit({
      req,
      action: 'USER_CREATED_BY_ADMIN',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      status: 'Success',
      details: {
        role: user.role,
        email: user.email,
        assignedClients: user.assignedClients.map(String),
        customPermissions: user.customPermissions,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        assignedClients: user.assignedClients,
        customPermissions: user.customPermissions,
        effectivePermissions: enriched.effectivePermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  updateUserRole,
  createUser,
};
