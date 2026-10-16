const mongoose = require('mongoose');

const DEFAULT_ROLE_PERMISSIONS = {
  'Platform Admin': {
    servers: true,
    terminal: true,
    operations: true,
    alerts: true,
    costs: true,
    auditLogs: true,
    users: true,
    settings: true,
  },
  'DevOps / Infrastructure': {
    servers: true,
    terminal: true,
    operations: true,
    alerts: true,
    costs: false,
    auditLogs: true,
    users: false,
    settings: false,
  },
  'Project Admin': {
    servers: true,
    terminal: false,
    operations: true,
    alerts: true,
    costs: false,
    auditLogs: false,
    users: false,
    settings: false,
  },
  'Client Admin': {
    servers: true,
    terminal: false,
    operations: false,
    alerts: true,
    costs: true,
    auditLogs: false,
    users: false,
    settings: false,
  },
  'Client Viewer': {
    servers: true,
    terminal: false,
    operations: false,
    alerts: true,
    costs: false,
    auditLogs: false,
    users: false,
    settings: false,
  },
  'Auditor': {
    servers: true,
    terminal: false,
    operations: false,
    alerts: false,
    costs: true,
    auditLogs: true,
    users: false,
    settings: false,
  },
  'Billing / Finance': {
    servers: false,
    terminal: false,
    operations: false,
    alerts: false,
    costs: true,
    auditLogs: false,
    users: false,
    settings: false,
  },
};

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: Object.keys(DEFAULT_ROLE_PERMISSIONS),
    },
    permissions: {
      servers: { type: Boolean, default: true },
      terminal: { type: Boolean, default: false },
      operations: { type: Boolean, default: false },
      alerts: { type: Boolean, default: true },
      costs: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: false },
      users: { type: Boolean, default: false },
      settings: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = {
  RolePermission: mongoose.model('RolePermission', rolePermissionSchema),
  DEFAULT_ROLE_PERMISSIONS,
};
