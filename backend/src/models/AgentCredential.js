const crypto = require('crypto');
const mongoose = require('mongoose');

// Per-server secret used by the host's metric shipper (vmagent) and infra-agent.
// Only the SHA-256 hash is stored; the plaintext is shown once when issued.
const agentCredentialSchema = new mongoose.Schema(
  {
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Server',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    tokenPrefix: {
      type: String,
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastUsedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

agentCredentialSchema.statics.hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = mongoose.model('AgentCredential', agentCredentialSchema);
