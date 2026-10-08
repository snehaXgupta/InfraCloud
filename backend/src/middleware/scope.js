/**
 * Tenant scoping (discovery doc §12: Role + Scope + Action).
 * Platform Admin and Auditor see every client; every other role only sees the clients in
 * user.assignedClients. Out-of-scope resources answer 404 so their existence is not revealed.
 */
const mongoose = require('mongoose');
const Server = require('../models/Server');
const Project = require('../models/Project');
const Environment = require('../models/Environment');
const Alert = require('../models/Alert');
const Operation = require('../models/Operation');

const GLOBAL_ROLES = ['Platform Admin', 'Auditor'];

const isGlobal = (user) => GLOBAL_ROLES.includes(user?.role);

const allowedClientIds = (user) => (user?.assignedClients || []).map((id) => id.toString());

const canAccessClient = (user, clientId) =>
  isGlobal(user) || (clientId != null && allowedClientIds(user).includes(clientId.toString()));

/** Mongo filter restricting a query to the caller's clients ({} for global roles). */
const clientFilter = (req, field = 'clientId') =>
  isGlobal(req.user) ? {} : { [field]: { $in: req.user.assignedClients || [] } };

/** Filter for models that only reference a server (alerts, operations). */
const serverFilter = async (req, field = 'serverId') => {
  if (isGlobal(req.user)) return {};
  const ids = await Server.find(clientFilter(req)).distinct('_id');
  return { [field]: { $in: ids } };
};

// clientId resolvers per resource type
const resolvers = {
  client: async (id) => id,
  server: async (id) => (await Server.findById(id).select('clientId').lean())?.clientId,
  project: async (id) => (await Project.findById(id).select('clientId').lean())?.clientId,
  environment: async (id) => {
    const env = await Environment.findById(id).select('projectId').lean();
    return env ? resolvers.project(env.projectId) : null;
  },
  alert: async (id) => {
    const alert = await Alert.findById(id).select('clientId serverId').lean();
    if (!alert) return null;
    return alert.clientId || resolvers.server(alert.serverId);
  },
  operation: async (id) => {
    const op = await Operation.findById(id).select('serverId').lean();
    return op ? resolvers.server(op.serverId) : null;
  },
};

const notFound = (res) => res.status(404).json({ success: false, error: 'Resource not found' });

/**
 * Guard a route by the resource it addresses.
 * @param {keyof resolvers} type
 * @param {(req) => string} pickId  where the id comes from (default: req.params.id)
 */
const requireScope = (type, pickId = (req) => req.params.id) => async (req, res, next) => {
  try {
    if (isGlobal(req.user)) return next();
    const id = pickId(req);
    if (!id) return next(); // nothing to check; controller validates required fields
    if (!mongoose.isValidObjectId(id)) return notFound(res);
    const clientId = await resolvers[type](id);
    if (!canAccessClient(req.user, clientId)) return notFound(res);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  GLOBAL_ROLES,
  isGlobal,
  canAccessClient,
  clientFilter,
  serverFilter,
  requireScope,
};
