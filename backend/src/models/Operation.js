const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: [true, 'Operation must target a valid Server'],
    },
    operationType: {
      type: String,
      enum: [
        'Health Check',
        'Service Restart',
        'Sync',
        'Replica Recovery',
        'Cleanup',
        'Agent Update',
        'Reboot',
        'Resize',
      ],
      required: [true, 'Operation must be an approved catalog action'],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Running', 'Succeeded', 'Failed', 'Cancelled'],
      default: 'Pending',
    },
    output: {
      type: String,
      default: '',
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Operation', operationSchema);
