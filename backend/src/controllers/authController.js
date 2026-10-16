const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');
const { getAllRolePermissions, getUserEffectivePermissions } = require('../services/rolePermissionService');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database connection is currently unavailable. Please verify database configuration in your deployment.',
      });
    }

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password credentials',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logAudit({
        req,
        user,
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'Auth',
        resourceName: email,
        status: 'Failed',
        details: { reason: 'Password mismatch' },
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password credentials',
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await logAudit({
      req,
      user,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'Auth',
      resourceName: user.email,
      status: 'Success',
      details: { role: user.role },
    });

    const token = generateToken(user._id);
    const roleMatrix = await getAllRolePermissions();
    const effectivePermissions = getUserEffectivePermissions(user, roleMatrix);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        customPermissions: user.customPermissions,
        effectivePermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    // Self-registration is allowed unless explicitly disabled via environment
    if (process.env.ALLOW_PUBLIC_REGISTRATION === 'false') {
      return res.status(403).json({
        success: false,
        error: 'Self-registration is currently disabled. Ask a Platform Admin for an account.',
      });
    }

    const { name, email, password, role } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database connection is currently unavailable. Please verify database configuration in your deployment.',
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email address already exists',
      });
    }

    // Assign requested role if valid, otherwise fallback to 'DevOps / Infrastructure'
    const validRoles = [
      'Platform Admin',
      'DevOps / Infrastructure',
      'Project Admin',
      'Client Admin',
      'Client Viewer',
      'Auditor',
      'Billing / Finance',
    ];
    const assignedRole = validRoles.includes(role) ? role : 'DevOps / Infrastructure';

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: assignedRole,
    });

    await logAudit({
      req,
      user,
      action: 'AUTH_REGISTER',
      resourceType: 'User',
      resourceId: user._id,
      resourceName: user.name,
      status: 'Success',
      details: { email: user.email, role: user.role },
    });

    const token = generateToken(user._id);
    const roleMatrix = await getAllRolePermissions();
    const effectivePermissions = getUserEffectivePermissions(user, roleMatrix);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        customPermissions: user.customPermissions,
        effectivePermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const roleMatrix = await getAllRolePermissions();
    const userObj = user.toObject();
    userObj.effectivePermissions = getUserEffectivePermissions(user, roleMatrix);

    res.json({
      success: true,
      user: userObj,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      if (req.body.password) {
        user.passwordHash = req.body.password;
      }
      const updatedUser = await user.save();

      await logAudit({
        req,
        user: updatedUser,
        action: 'USER_PROFILE_UPDATE',
        resourceType: 'User',
        resourceId: updatedUser._id,
        resourceName: updatedUser.name,
        status: 'Success',
      });

      res.json({
        success: true,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register, getMe, updateProfile };
