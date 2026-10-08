const express = require('express');
const router = express.Router();
const c = require('../controllers/resizeController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Scoping and approver rules are enforced in the controller (requester ≠ approver, roles, client scope)
router.get('/', c.listResizeRequests);
router.get('/:id', c.getResizeRequest);
router.post('/:id/approve', c.approveResizeRequest);
router.post('/:id/reject', c.rejectResizeRequest);
router.post('/:id/cancel', c.cancelResizeRequest);

module.exports = router;
