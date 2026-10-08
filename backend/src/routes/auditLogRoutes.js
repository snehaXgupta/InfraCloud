const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');

router.use(protect);
// Audit entries are not tenant-tagged yet, so only global roles may read them.
router.use(authorize(R.ADMIN, R.AUDITOR));

router.get('/', getAuditLogs);

module.exports = router;
