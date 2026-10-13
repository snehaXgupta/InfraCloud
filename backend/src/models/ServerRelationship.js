const mongoose = require('mongoose');

/**
 * Explicit primary → replica relationship (discovery doc §9: "model primary/replica relationships
 * explicitly rather than relying on hostnames"). One document per replica.
 *
 * States: Healthy → Degraded → Sync Required → Sync Running → Sync Verified → Healthy,
 *         plus Primary Down (replica cannot catch up until the primary is back) and Unknown.
 */
const serverRelationshipSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
    primaryServerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    replicaServerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true, unique: true },
    kind: { type: String, enum: ['postgres', 'mysql'], required: true },
    lagWarnSeconds: { type: Number, default: 60, min: 1 },
    lagCritSeconds: { type: Number, default: 300, min: 1 },

    state: {
      type: String,
      enum: ['Unknown', 'Healthy', 'Degraded', 'Sync Required', 'Sync Running', 'Sync Verified', 'Primary Down'],
      default: 'Unknown',
    },
    stateChangedAt: Date,
    lastLagSeconds: Number,
    lastCheckAt: Date,
    lastCheckError: String,
    lagHistory: [{ _id: false, at: Date, lag: Number }],
    lastSync: {
      at: Date,
      type: { type: String },
      status: String,
      durationMs: Number,
      operationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operation' },
      detail: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServerRelationship', serverRelationshipSchema);
