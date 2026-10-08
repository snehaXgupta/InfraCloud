const AuditLog = require('../models/AuditLog');

// @desc    Get audit logs
// @route   GET /api/audit-logs
// @access  Private
const getAuditLogs = async (req, res, next) => {
  try {
    const { resourceType, status, search, limit = 50 } = req.query;
    const query = {};

    if (resourceType && resourceType !== 'all') query.resourceType = resourceType;
    if (status && status !== 'all') query.status = status;

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } },
      ];
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
