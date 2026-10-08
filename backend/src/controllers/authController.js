const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');

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

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
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
    // Self-signup is off by default; admins invite users via POST /api/users.
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Self-registration is disabled. Ask a Platform Admin for an account.',
      });
    }

    const { name, email, password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email address already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      // Never trust a client-supplied role; self-registered users start read-only with no client scope.
      role: 'Client Viewer',
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

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
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
    res.json({
      success: true,
      user,
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
