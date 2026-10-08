const AgentCredential = require('../models/AgentCredential');

// Hosts report every few seconds, so cache token lookups briefly. Revocation takes effect within this TTL.
const TOKEN_CACHE_TTL_MS = 30 * 1000;
const tokenCache = new Map();

const bearerToken = (req) => {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
};

/** @returns {Promise<object|null>} the active credential ({ serverId, ... }) for a plaintext token */
const resolveAgentToken = async (token) => {
  if (!token) return null;
  const tokenHash = AgentCredential.hashToken(token);
  const cached = tokenCache.get(tokenHash);
  if (cached && Date.now() - cached.at < TOKEN_CACHE_TTL_MS) return cached.credential;

  const credential = await AgentCredential.findOne({ tokenHash, revokedAt: null }).lean();
  if (tokenCache.size > 10000) tokenCache.clear();
  tokenCache.set(tokenHash, { at: Date.now(), credential });
  if (credential && (!credential.lastUsedAt || Date.now() - credential.lastUsedAt.getTime() > 60 * 1000)) {
    AgentCredential.updateOne({ _id: credential._id }, { lastUsedAt: new Date() }).catch(() => {});
  }
  return credential;
};

/** Express middleware: requires a valid agent token and sets req.agentServerId. */
const requireAgentToken = async (req, res, next) => {
  try {
    const credential = await resolveAgentToken(bearerToken(req));
    if (!credential) return res.status(401).json({ success: false, error: 'Invalid or missing agent token' });
    req.agentServerId = credential.serverId.toString();
    next();
  } catch (err) {
    res.status(503).json({ success: false, error: 'Credential store unavailable' });
  }
};

module.exports = { bearerToken, resolveAgentToken, requireAgentToken };
