const Client = require('../models/Client');
const Project = require('../models/Project');
const Environment = require('../models/Environment');
const Server = require('../models/Server');
const Alert = require('../models/Alert');
const Operation = require('../models/Operation');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { clientFilter, serverFilter, isGlobal } = require('../middleware/scope');

// @desc    Get complete dashboard summary and infrastructure telemetry
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = async (req, res, next) => {
  try {
    // Every count below is limited to the caller's clients; user and audit totals are global-only.
    const global = isGlobal(req.user);
    const byClient = clientFilter(req);
    const byServer = await serverFilter(req);
    const scopedProjectIds = global ? null : await Project.find(byClient).distinct('_id');
    const byProject = global ? {} : { projectId: { $in: scopedProjectIds } };
    const none = Promise.resolve(0);

    const [
      totalUsers,
      activeUsers,
      totalClients,
      totalProjects,
      totalEnvironments,
      servers,
      activeAlerts,
      recentAlerts,
      recentOperations,
      recentAuditLogs,
      totalAuditLogs,
    ] = await Promise.all([
      global ? User.countDocuments() : none,
      global ? User.countDocuments({ status: 'active' }) : none,
      Client.countDocuments(clientFilter(req, '_id')),
      Project.countDocuments(byClient),
      Environment.countDocuments(byProject),
      Server.find(byClient)
        .populate('clientId', 'name')
        .populate('projectId', 'name')
        .populate('environmentId', 'name type'),
      Alert.find({ status: { $ne: 'resolved' }, ...byServer }),
      Alert.find({ status: { $ne: 'resolved' }, ...byServer })
        .populate('serverId', 'name hostname provider status')
        .sort({ createdAt: -1 })
        .limit(6),
      Operation.find(byServer)
        .populate('serverId', 'name hostname provider')
        .populate('requestedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(6),
      global ? AuditLog.find().sort({ createdAt: -1 }).limit(10) : Promise.resolve([]),
      global ? AuditLog.countDocuments() : none,
    ]);

    // Compute health metrics
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let offlineCount = 0;
    let maintenanceCount = 0;

    let totalCpu = 0;
    let totalMemory = 0;
    let totalDisk = 0;

    const providerCounts = {};

    let totalStorageUsedGb = 0;
    let totalStorageMaxGb = 0;

    servers.forEach((s) => {
      if (s.status === 'healthy') healthyCount++;
      else if (s.status === 'warning') warningCount++;
      else if (s.status === 'critical') criticalCount++;
      else if (s.status === 'offline') offlineCount++;
      else if (s.status === 'maintenance') maintenanceCount++;

      totalCpu += s.metricsSummary?.cpuUsage || 0;
      totalMemory += s.metricsSummary?.memoryUsage || 0;
      totalDisk += s.metricsSummary?.diskUsage || 0;
      totalStorageUsedGb += s.storage?.diskUsedGb || 0;
      totalStorageMaxGb += s.storage?.diskTotalGb || 0;

      const prov = s.provider || 'Other';
      providerCounts[prov] = (providerCounts[prov] || 0) + 1;
    });

    const serverCount = servers.length;
    const avgCpu = serverCount > 0 ? Math.round(totalCpu / serverCount) : 0;
    const avgMemory = serverCount > 0 ? Math.round(totalMemory / serverCount) : 0;
    const avgDisk = serverCount > 0 ? Math.round(totalDisk / serverCount) : 0;

    const warningAlertsCount = activeAlerts.filter((a) => a.severity === 'Warning').length;
    const criticalAlertsCount = activeAlerts.filter((a) => a.severity === 'Critical').length;

    // Build unified clean activity items for dashboard activity feed
    const activities = recentAuditLogs.map((log) => ({
      _id: log._id,
      category: log.action.toLowerCase().includes('login') ? 'login' : log.action.toLowerCase().replace(/_/g, ' '),
      title: log.userName ? `User ${log.userEmail || log.userName} ${log.action.toLowerCase().replace(/_/g, ' ')}` : `${log.action} on ${log.resourceName || log.resourceType}`,
      timestamp: log.createdAt,
      status: log.status,
    }));

    // If no audit logs yet, create standard seed-friendly activity stream
    if (activities.length === 0) {
      activities.push(
        {
          _id: 'act-1',
          category: 'login',
          title: `User ${req.user?.email || 'admin@simpel.ai'} logged in`,
          timestamp: new Date().toISOString(),
        },
        {
          _id: 'act-2',
          category: 'login',
          title: `User ${req.user?.email || 'admin@simpel.ai'} logged in`,
          timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        },
        {
          _id: 'act-3',
          category: 'login',
          title: `User ${req.user?.email || 'admin@simpel.ai'} logged in`,
          timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        },
        {
          _id: 'act-4',
          category: 'logout',
          title: `User logged out`,
          timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        }
      );
    }

    // Infrastructure health score (0-100)
    const healthScore = serverCount > 0
      ? Math.max(0, Math.round(((healthyCount * 1.0 + warningCount * 0.5) / serverCount) * 100))
      : 100;

    // Telemetry trend points (simulated 24h trend for dashboard overview charts)
    const telemetryTrends = Array.from({ length: 12 }).map((_, i) => {
      const hour = (new Date().getHours() - (11 - i) * 2 + 24) % 24;
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      return {
        time: hourStr,
        avgCpu: Math.min(95, Math.max(10, Math.round(avgCpu + Math.sin(i) * 12 + (i % 3 === 0 ? 5 : -3)))),
        avgMemory: Math.min(95, Math.max(20, Math.round(avgMemory + Math.cos(i) * 6))),
        networkTraffic: Math.round(180 + Math.sin(i * 0.8) * 80 + i * 5),
      };
    });

    res.json({
      success: true,
      data: {
        counts: {
          users: totalUsers,
          activeUsers,
          clients: totalClients,
          projects: totalProjects,
          environments: totalEnvironments,
          servers: serverCount,
          activeServers: healthyCount + warningCount,
          totalAuditLogs,
          totalStorageUsedGb,
          totalStorageMaxGb,
        },
        health: {
          healthy: healthyCount,
          warning: warningCount,
          critical: criticalCount,
          offline: offlineCount,
          maintenance: maintenanceCount,
          healthScore,
        },
        alerts: {
          totalActive: activeAlerts.length,
          warning: warningAlertsCount,
          critical: criticalAlertsCount,
          recent: recentAlerts,
        },
        operations: {
          recent: recentOperations,
        },
        activities,
        averages: {
          cpu: avgCpu,
          memory: avgMemory,
          disk: avgDisk,
        },
        providerDistribution: providerCounts,
        telemetryTrends,
        topServers: servers.slice(0, 8),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardSummary };
