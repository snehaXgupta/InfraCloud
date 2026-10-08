const crypto = require('crypto');
const Server = require('../models/Server');
const AgentCredential = require('../models/AgentCredential');
const { logAudit } = require('../services/auditService');

// @desc    Issue a new agent token for a server (revokes any previous token).
//          The plaintext token is returned once and never stored.
// @route   POST /api/servers/:id/agent-token
// @access  Platform Admin, DevOps / Infrastructure
const issueAgentToken = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const token = `sma_${crypto.randomBytes(32).toString('base64url')}`;

    await AgentCredential.updateMany({ serverId: server._id, revokedAt: null }, { revokedAt: new Date() });
    await AgentCredential.create({
      serverId: server._id,
      tokenHash: AgentCredential.hashToken(token),
      tokenPrefix: token.slice(0, 10),
      issuedBy: req.user._id,
    });

    await logAudit({
      req,
      action: 'AGENT_TOKEN_ISSUE',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      status: 'Success',
      details: { tokenPrefix: token.slice(0, 10) },
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        serverId: server._id,
        ingestUrl: `${req.protocol}://${req.get('host')}/ingest/metrics`,
        note: 'Store this token now; it cannot be shown again.',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { issueAgentToken };
