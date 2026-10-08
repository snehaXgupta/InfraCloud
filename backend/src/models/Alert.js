const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: [true, 'Alert must be linked to a Server'],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    environmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
    },
    severity: {
      type: String,
      enum: ['Warning', 'Critical', 'Info'],
      required: [true, 'Please specify severity (Warning, Critical, or Info)'],
    },
    metric: {
      type: String,
      enum: ['CPU', 'Memory', 'Disk', 'Heartbeat', 'Server Down', 'Replica', 'Sync', 'Agent', 'Cost', 'Network', 'Process Crash', 'Replication Delay'],
      required: [true, 'Please specify alert metric'],
    },
    currentValue: {
      type: String,
      required: true,
    },
    threshold: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
    },
    message: {
      type: String,
      required: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Alert', alertSchema);
