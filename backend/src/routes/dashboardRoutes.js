const express = require('express');
const router = express.Router();
const { getDashboardSummary } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getDashboardSummary);

module.exports = router;
