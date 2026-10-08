const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  { type: { type: String }, vcpu: Number, ramGb: Number, diskGb: Number, priceMonthly: Number },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    status: { type: String, enum: ['pending', 'running', 'done', 'failed', 'skipped'], default: 'pending' },
    detail: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { _id: false }
);

/**
 * A resize change request (discovery doc §10): request → approval → queued job → steps → result.
 * The job state lives here so progress survives page reloads and API restarts.
 */
const resizeRequestSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    serverName: String,
    environmentType: String,
    provider: String,
    integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration' },
    instanceId: String,

    fromPlan: planSchema,
    toPlan: planSchema,
    currency: String,
    monthlyCostDelta: Number,
    downtime: String,
    reason: { type: String, required: true },
    takeSnapshot: { type: Boolean, default: true },
    previousServerStatus: String,
    operationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operation' },
    scheduledFor: Date,

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requiresApproval: { type: Boolean, default: false },
    decisions: [
      {
        _id: false,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: String,
        decision: { type: String, enum: ['approved', 'rejected'] },
        comment: String,
        at: Date,
      },
    ],
    expiresAt: Date,

    status: {
      type: String,
      enum: ['pending_approval', 'queued', 'running', 'succeeded', 'failed', 'rejected', 'cancelled', 'expired'],
      default: 'pending_approval',
      index: true,
    },
    runAfter: Date,
    workerId: String,
    workerHeartbeatAt: Date,
    steps: [stepSchema],
    snapshotId: String,
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResizeRequest', resizeRequestSchema);
