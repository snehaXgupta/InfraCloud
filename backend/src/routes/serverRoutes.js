const express = require('express');
const router = express.Router();
const {
  getServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
} = require('../controllers/serverController');
const { getResizeOptions, createResizeRequest } = require('../controllers/resizeController');
const { getServerMetrics } = require('../controllers/metricsController');
const { issueAgentToken } = require('../controllers/agentCredentialController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);

const SERVER_MANAGERS = [R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN];
const bodyClient = requireScope('client', (req) => req.body.clientId);

router.route('/')
  .get(getServers)
  .post(authorize(...SERVER_MANAGERS), bodyClient, createServer);

router.use('/:id', requireScope('server'));

router.route('/:id')
  .get(getServerById)
  .put(authorize(...SERVER_MANAGERS), bodyClient, updateServer)
  .delete(authorize(R.ADMIN), deleteServer);

router.get('/:id/metrics', getServerMetrics);
router.post('/:id/agent-token', authorize(R.ADMIN, R.DEVOPS), issueAgentToken);
router.get('/:id/resize-options', getResizeOptions);
router.post('/:id/resize-requests', authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN), createResizeRequest);

module.exports = router;
