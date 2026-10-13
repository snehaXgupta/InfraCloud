const express = require('express');
const router = express.Router();
const c = require('../controllers/operationController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);
// Client Viewer and Billing have no operations access (discovery doc §12)
router.use(authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN, R.CLIENT_ADMIN, R.AUDITOR));

router.get('/catalog', c.getCatalog);

router.route('/')
  .get(c.getOperations)
  .post(
    authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN),
    requireScope('server', (req) => req.body.serverId),
    c.createOperation
  );

router.get('/:id', requireScope('operation'), c.getOperationById);
// Approver rules (role, not the requester) are enforced in the controller
router.post('/:id/approve', requireScope('operation'), c.approveOperation);
router.post('/:id/reject', requireScope('operation'), c.rejectOperation);
router.post('/:id/cancel', requireScope('operation'), c.cancelOperation);

module.exports = router;
