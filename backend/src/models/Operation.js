const mongoose = require('mongoose');

/**
 * An operation run on a server through its agent (discovery doc §8).
 * Lifecycle: Awaiting Approval → Queued → Dispatched (agent picked it up) → Running →
 *            [Verifying (reboot / agent update)] → Succeeded | Failed
 * Side exits: Rejected, Cancelled, Expired (approval not given in time).
 */
const operationSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: [true, 'Operation must target a valid Server'],
      index: true,
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    serverName: String,
    environmentType: String,
    operationType: {
      type: String,
      enum: ['Health Check', 'Service Restart', 'Sync', 'Replica Recovery', 'Cleanup', 'Agent Update', 'Reboot', 'Resize'],
      required: [true, 'Operation must be an approved catalog action'],
    },
    catalogKey: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: String,
    status: {
      type: String,
      enum: [
        'Awaiting Approval',
        'Queued',
        'Dispatched',
        'Running',
        'Verifying',
        'Succeeded',
        'Failed',
        'Rejected',
        'Cancelled',
        'Expired',
        'Pending', // legacy
      ],
      default: 'Queued',
      index: true,
    },

    // Approval (§8.1 step 3)
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
    approvalExpiresAt: Date,

    // Execution (§8.1 steps 4–8)
    jobId: { type: String, index: true },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    replicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServerRelationship' },
    runAfter: Date,
    queuedAt: Date,
    dispatchedAt: Date,
    // The agent credential the job was handed to: only that agent may report on it
    dispatchedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentCredential' },
    startedAt: Date,
    deadlineAt: Date,
    exitCode: Number,
    output: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed },
    postCheck: {
      ok: Boolean,
      detail: String,
    },
    verify: { type: mongoose.Schema.Types.Mixed }, // e.g. { bootTimeBefore } or { expectedVersion }
    error: String,
    executionTimeMs: {
      type: Number,
      default: 0,
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
