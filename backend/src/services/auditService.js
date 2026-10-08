const AuditLog = require('../models/AuditLog');

const logAudit = async ({
  req,
  user,
  action,
  resourceType,
  resourceId = '',
  resourceName = '',
  status = 'Success',
  details = {},
}) => {
  try {
    const currentUser = user || req?.user;
    const ipAddress =
      req?.headers['x-forwarded-for'] ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';
    const userAgent = req?.headers['user-agent'] || '';

    await AuditLog.create({
      userId: currentUser?._id,
      userName: currentUser?.name || 'Automated System',
      userEmail: currentUser?.email || 'system@infra.internal',
      userRole: currentUser?.role || 'System',
      action,
      resourceType,
      resourceId: resourceId ? resourceId.toString() : '',
      resourceName,
      status,
      ipAddress,
      userAgent,
      details,
    });
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
};

module.exports = { logAudit };
