const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
      default: 'System / Guest',
    },
    userEmail: {
      type: String,
      default: 'system@infra.internal',
    },
    userRole: {
      type: String,
      default: 'System',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      enum: ['Server', 'Operation', 'Alert', 'Client', 'Project', 'Environment', 'User', 'Auth', 'System'],
      required: true,
    },
    resourceId: {
      type: String,
      default: '',
    },
    resourceName: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Success', 'Failed', 'Warning'],
      default: 'Success',
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
