const express = require('express');
const router = express.Router();
const {
  getCostSummary,
  getServerCost,
  setServerRate,
  importActuals,
  refreshCosts,
} = require('../controllers/costController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);

// Every role may view costs within its client scope; Billing and Platform Admin manage them (§12)
const COST_MANAGERS = [R.ADMIN, R.BILLING];

router.get('/summary', getCostSummary);
router.get('/servers/:id', requireScope('server'), getServerCost);
router.put('/servers/:id/rate', authorize(...COST_MANAGERS), requireScope('server'), setServerRate);
router.post('/actuals', authorize(...COST_MANAGERS), importActuals);
router.post('/refresh', authorize(...COST_MANAGERS), refreshCosts);

module.exports = router;
