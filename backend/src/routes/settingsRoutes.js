const express = require('express');
const router = express.Router();
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { getEmailMute, setEmailMute } = require('../services/notificationSettings');
const { logAudit } = require('../services/auditService');

router.use(protect);

/**
 * @desc    Alert email mute status
 * @route   GET /api/settings/notifications
 * @access  Private
 */
router.get('/notifications', async (req, res, next) => {
  try {
    res.json({ success: true, data: { emailMute: await getEmailMute() } });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Mute / unmute alert emails. Alerts are still recorded while muted.
 * @route   PUT /api/settings/notifications  { muted: boolean, minutes?: number }  (no minutes = until unmuted)
 * @access  Platform Admin
 */
router.put('/notifications', authorize(R.ADMIN), async (req, res, next) => {
  try {
    const { muted, minutes } = req.body;
    if (typeof muted !== 'boolean') {
      return res.status(400).json({ success: false, error: 'muted must be true or false' });
    }
    if (minutes != null && !(Number.isInteger(minutes) && minutes > 0 && minutes <= 60 * 24 * 30)) {
      return res.status(400).json({ success: false, error: 'minutes must be a whole number between 1 and 43200' });
    }

    const emailMute = await setEmailMute({ muted, minutes }, req.user);
    await logAudit({
      req,
      action: muted ? 'ALERT_EMAILS_MUTED' : 'ALERT_EMAILS_UNMUTED',
      resourceType: 'System',
      resourceName: 'Alert email notifications',
      details: { until: emailMute.until },
    });

    res.json({ success: true, data: { emailMute } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
