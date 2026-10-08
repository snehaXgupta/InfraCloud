const express = require('express');
const router = express.Router();
const {
  getOperations,
  getOperationById,
  createOperation,
} = require('../controllers/operationController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);
// Client Viewer and Billing have no operations access (discovery doc §12)
router.use(authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN, R.CLIENT_ADMIN, R.AUDITOR));

router.route('/')
  .get(getOperations)
  .post(
    authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN),
    requireScope('server', (req) => req.body.serverId),
    createOperation
  );

router.route('/:id')
  .get(requireScope('operation'), getOperationById);

module.exports = router;
