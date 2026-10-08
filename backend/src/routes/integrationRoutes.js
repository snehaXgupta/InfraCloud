const express = require('express');
const router = express.Router();
const c = require('../controllers/integrationController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');

router.use(protect);
// Provider accounts hold client API keys: Platform Admin manages them, DevOps may view and test
router.use(authorize(R.ADMIN, R.DEVOPS));

router.get('/', c.listIntegrations);
router.post('/', authorize(R.ADMIN), c.createIntegration);
router.post('/:id/test', c.testIntegration);
router.get('/:id/instances', c.listInstances);
router.post('/:id/link', authorize(R.ADMIN), c.linkServers);
router.post('/:id/sync-plans', authorize(R.ADMIN), c.syncIntegrationPlans);
router.delete('/:id', authorize(R.ADMIN), c.deleteIntegration);

module.exports = router;
