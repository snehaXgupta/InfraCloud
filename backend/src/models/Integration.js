const mongoose = require('mongoose');

/**
 * A connection to a cloud provider account (e.g. a client's Vultr account).
 * The API key is stored encrypted (services/secretBox) and is never returned by the API.
 */
const integrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['Vultr', 'Simulated'], required: true },
    // Optional tenant ownership: scoped users only see integrations of their clients
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    credentials: {
      iv: String,
      tag: String,
      data: String,
    },
    keyHint: { type: String }, // last 4 characters, for display
    status: { type: String, enum: ['unverified', 'connected', 'error'], default: 'unverified' },
    lastCheckedAt: { type: Date },
    lastError: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

integrationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.credentials;
    return ret;
  },
});

module.exports = mongoose.model('Integration', integrationSchema);
