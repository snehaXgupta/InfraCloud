const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        JWT_SECRET
      );

      req.user = await User.findById(decoded.id).select('-passwordHash');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User associated with this token no longer exists',
        });
      }

      if (req.user.status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'Your account has been suspended. Contact Platform Admin.',
        });
      }

      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, invalid or expired token',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no authorization token provided',
    });
  }
};

const ROLES = {
  ADMIN: 'Platform Admin',
  DEVOPS: 'DevOps / Infrastructure',
  PROJECT_ADMIN: 'Project Admin',
  CLIENT_ADMIN: 'Client Admin',
  VIEWER: 'Client Viewer',
  AUDITOR: 'Auditor',
  BILLING: 'Billing / Finance',
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user?.role || 'Guest'}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize, ROLES };
