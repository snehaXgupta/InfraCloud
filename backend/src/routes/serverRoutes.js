const express = require('express');
const router = express.Router();
const {
  getServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  addWebsiteToServer,
  deleteWebsiteFromServer,
  updateWebServerInfo,
  fetchAndAddServer,
  restartServer,
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

router.post('/fetch-and-add', authorize(...SERVER_MANAGERS), fetchAndAddServer);

router.use('/:id', requireScope('server'));

router.route('/:id')
  .get(getServerById)
  .put(authorize(...SERVER_MANAGERS), bodyClient, updateServer)
  .delete(authorize(R.ADMIN), deleteServer);

router.post('/:id/restart', authorize(...SERVER_MANAGERS), restartServer);
router.get('/:id/metrics', getServerMetrics);
router.post('/:id/agent-token', authorize(R.ADMIN, R.DEVOPS), issueAgentToken);
router.get('/:id/resize-options', getResizeOptions);
router.post('/:id/resize-requests', authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN), createResizeRequest);
router.post('/:id/websites', authorize(...SERVER_MANAGERS), addWebsiteToServer);
router.delete('/:id/websites/:websiteId', authorize(...SERVER_MANAGERS), deleteWebsiteFromServer);
router.put('/:id/web-server', authorize(...SERVER_MANAGERS), updateWebServerInfo);

module.exports = router;
