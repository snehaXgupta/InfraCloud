const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  createAlert,
  testSMTPAlert,
  simulateAlert,
} = require('../controllers/alertController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);

const ALERT_RESPONDERS = [R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN, R.CLIENT_ADMIN];

router.post('/test-smtp', authorize(R.ADMIN), testSMTPAlert);
router.post('/simulate', authorize(R.ADMIN), simulateAlert);

router.route('/')
  .get(getAlerts)
  .post(authorize(R.ADMIN), createAlert);

router.route('/:id')
  .get(requireScope('alert'), getAlertById);

router.patch('/:id/acknowledge', authorize(...ALERT_RESPONDERS), requireScope('alert'), acknowledgeAlert);
router.patch('/:id/resolve', authorize(...ALERT_RESPONDERS), requireScope('alert'), resolveAlert);

module.exports = router;
