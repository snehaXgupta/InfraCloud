const Alert = require('../models/Alert');
const { logAudit } = require('../services/auditService');
const { serverFilter } = require('../middleware/scope');

// @desc    Get all alerts with filtering
// @route   GET /api/alerts
// @access  Private
const getAlerts = async (req, res, next) => {
  try {
    const { serverId, severity, status, metric } = req.query;
    const query = {};

    if (serverId) query.serverId = serverId;
    if (severity && severity !== 'all') query.severity = severity;
    if (status && status !== 'all') query.status = status;
    if (metric && metric !== 'all') query.metric = metric;

    const alerts = await Alert.find({ $and: [query, await serverFilter(req)] })
      .populate('serverId', 'name hostname provider region status')
      .populate('clientId', 'name')
      .populate('projectId', 'name')
      .populate('environmentId', 'name type')
      .populate('acknowledgedBy', 'name email')
      .sort({ createdAt: -1 });

    const stats = {
      total: alerts.length,
      active: alerts.filter((a) => a.status === 'active').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
      critical: alerts.filter((a) => a.severity === 'Critical' && a.status !== 'resolved').length,
      warning: alerts.filter((a) => a.severity === 'Warning' && a.status !== 'resolved').length,
    };

    res.json({
      success: true,
      stats,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Private
const getAlertById = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('serverId')
      .populate('clientId', 'name')
      .populate('projectId', 'name')
      .populate('acknowledgedBy', 'name email');

    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Acknowledge alert
// @route   PATCH /api/alerts/:id/acknowledge
// @access  Private
const acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id).populate('serverId', 'name');
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();
    await alert.save();

    await logAudit({
      req,
      action: 'ALERT_ACKNOWLEDGE',
      resourceType: 'Alert',
      resourceId: alert._id,
      resourceName: `${alert.metric} Alert (${alert.severity}) on ${alert.serverId?.name || 'Server'}`,
      status: 'Success',
      details: { metric: alert.metric, currentValue: alert.currentValue },
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('serverId', 'name hostname provider status')
      .populate('acknowledgedBy', 'name email');

    res.json({
      success: true,
      data: populatedAlert,
      message: 'Alert acknowledged successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve alert
// @route   PATCH /api/alerts/:id/resolve
// @access  Private
const resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id).populate('serverId', 'name');
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();

    await logAudit({
      req,
      action: 'ALERT_RESOLVE',
      resourceType: 'Alert',
      resourceId: alert._id,
      resourceName: `${alert.metric} Alert (${alert.severity}) on ${alert.serverId?.name || 'Server'}`,
      status: 'Success',
      details: { metric: alert.metric },
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('serverId', 'name hostname provider status')
      .populate('acknowledgedBy', 'name email');

    res.json({
      success: true,
      data: populatedAlert,
      message: 'Alert marked as resolved',
    });
  } catch (error) {
    next(error);
  }
};

const Server = require('../models/Server');
const { sendAlertEmail, verifySMTP } = require('../services/emailService');

// @desc    Create alert
// @route   POST /api/alerts
// @access  Private
const createAlert = async (req, res, next) => {
  try {
    const { serverId, clientId, projectId, environmentId, severity, metric, currentValue, threshold, message } = req.body;

    const alert = await Alert.create({
      serverId,
      clientId,
      projectId,
      environmentId,
      severity,
      metric,
      currentValue,
      threshold,
      message,
    });

    const targetServer = await Server.findById(serverId);

    // Send email alert in background via SMTP
    sendAlertEmail({
      serverName: targetServer?.name || 'Server Node',
      ip: targetServer?.network?.publicIp || '127.0.0.1',
      severity: alert.severity,
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      message: alert.message,
    }).catch((err) => console.error('[Alert Email Error]', err));

    await logAudit({
      req,
      action: 'ALERT_TRIGGERED',
      resourceType: 'Alert',
      resourceId: alert._id,
      resourceName: `${severity} ${metric} Alert`,
      status: 'Warning',
      details: { currentValue, threshold },
    });

    res.status(201).json({
      success: true,
      data: alert,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Simulate specific alert rule test (warning, critical, or server down)
// @route   POST /api/alerts/simulate
// @access  Private
const simulateAlert = async (req, res, next) => {
  try {
    const { type = 'critical', serverId } = req.body;
    
    // Find server or first available
    let targetServer = null;
    if (serverId) {
      targetServer = await Server.findById(serverId);
    }
    if (!targetServer) {
      targetServer = await Server.findOne() || {
        _id: '60c72b2f9b1d8b2badbee123',
        name: 'luxStag',
        network: { publicIp: '142.93.215.161' },
      };
    }

    let alertData = {};

    if (type === 'warning') {
      alertData = {
        severity: 'Warning',
        metric: 'CPU',
        currentValue: '88.4%',
        threshold: '>85% for 10 min',
        message: `High CPU load detected on ${targetServer.name} (88.4% utilization exceeding 85% warning limit).`,
      };
    } else if (type === 'server-down' || type === 'heartbeat') {
      alertData = {
        severity: 'Critical',
        metric: 'Heartbeat',
        currentValue: 'Missing (4.2m)',
        threshold: '3–5 min grace period',
        message: `Heartbeat missing on ${targetServer.name} (${targetServer.network?.publicIp || '142.93.215.161'}). Agent unreachable for >4 minutes.`,
      };
    } else if (type === 'disk') {
      alertData = {
        severity: 'Critical',
        metric: 'Disk',
        currentValue: '93.8%',
        threshold: '>90%',
        message: `Root storage volume critical on ${targetServer.name} (93.8% capacity used).`,
      };
    } else {
      // Default critical
      alertData = {
        severity: 'Critical',
        metric: 'Memory',
        currentValue: '97.2%',
        threshold: '>95% for 5 min',
        message: `Critical resident memory exhaustion on ${targetServer.name} (97.2% allocated).`,
      };
    }

    let createdAlert = null;
    try {
      createdAlert = await Alert.create({
        serverId: targetServer._id,
        clientId: targetServer.clientId,
        projectId: targetServer.projectId,
        environmentId: targetServer.environmentId,
        severity: alertData.severity,
        metric: alertData.metric,
        currentValue: alertData.currentValue,
        threshold: alertData.threshold,
        message: alertData.message,
      });
    } catch (e) {
      // If validation fails due to unseeded IDs, still allow sending email
    }

    // Trigger SMTP Email Alert
    const emailRes = await sendAlertEmail({
      serverName: targetServer.name,
      ip: targetServer.network?.publicIp || '142.93.215.161',
      severity: alertData.severity,
      metric: alertData.metric,
      currentValue: alertData.currentValue,
      threshold: alertData.threshold,
      message: alertData.message,
    });

    res.json({
      success: true,
      data: createdAlert,
      emailSent: emailRes.success,
      message: `${alertData.severity} alert triggered (${alertData.metric})! Email notification dispatched to ${process.env.ALERT_RECIPIENT_EMAIL || process.env.SMTP_USER}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test SMTP email dispatch
// @route   POST /api/alerts/test-smtp
// @access  Private
const testSMTPAlert = async (req, res, next) => {
  try {
    const check = await verifySMTP();
    if (!check.success) {
      return res.status(400).json({
        success: false,
        error: `SMTP connection verification failed: ${check.message}. Please check your .env settings (SMTP_USER, SMTP_PASS).`,
      });
    }

    const result = await sendAlertEmail({
      serverName: 'luxStag (Test Node)',
      ip: '142.93.215.161',
      severity: 'Critical',
      metric: 'CPU Utilization',
      currentValue: '96.4%',
      threshold: '>90%',
      message: 'This is a test notification from Simpel SPACES PANEL. Your SMTP integration is working perfectly!',
      ignoreMute: true,
    });

    if (result.success) {
      res.json({
        success: true,
        message: `Test alert email sent successfully to ${process.env.ALERT_RECIPIENT_EMAIL || process.env.SMTP_USER}`,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to dispatch test email',
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  resolveAlert,
  createAlert,
  testSMTPAlert,
  simulateAlert,
};
