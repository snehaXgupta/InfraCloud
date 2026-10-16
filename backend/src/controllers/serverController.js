const mongoose = require('mongoose');
const Server = require('../models/Server');
const Alert = require('../models/Alert');
const Operation = require('../models/Operation');
const { logAudit } = require('../services/auditService');
const { clientFilter } = require('../middleware/scope');
const { rateFor, CURRENCY } = require('../services/costService');

// @desc    Get all servers with optional query filters
// @route   GET /api/servers
// @access  Private
const getServers = async (req, res, next) => {
  try {
    const { clientId, projectId, environmentId, status, provider, search } = req.query;
    const query = {};

    if (clientId) query.clientId = clientId;
    if (projectId) query.projectId = projectId;
    if (environmentId) query.environmentId = environmentId;
    if (status && status !== 'all') query.status = status;
    if (provider && provider !== 'all') query.provider = provider;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { hostname: { $regex: search, $options: 'i' } },
        { 'network.publicIp': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const servers = await Server.find({ $and: [query, clientFilter(req)] })
      .populate('clientId', 'name tier')
      .populate('projectId', 'name')
      .populate('environmentId', 'name type')
      .sort({ updatedAt: -1 });

    // Same monthly rate the Costs page uses, so cards and cost reports always agree
    const data = servers.map((s) => ({
      ...s.toJSON(),
      monthlyCost: { ...rateFor(s), currency: s.cost?.currency || CURRENCY },
    }));

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single server by ID with active alerts & operations
// @route   GET /api/servers/:id
// @access  Private
const getServerById = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id)
      .populate('clientId', 'name tier contactEmail')
      .populate('projectId', 'name repositoryUrl')
      .populate('environmentId', 'name type status');

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // Fetch active alerts for this server
    const alerts = await Alert.find({ serverId: server._id })
      .populate('acknowledgedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Fetch recent operations
    const operations = await Operation.find({ serverId: server._id })
      .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Mock realistic simulated running processes and system services for details view
    const runningServices = [
      { name: 'nginx.service', status: 'active (running)', pid: 1042, memory: '42.1 MB', cpu: '0.8%', uptime: '14d 6h' },
      { name: 'docker.service', status: 'active (running)', pid: 1488, memory: '1.2 GB', cpu: '4.2%', uptime: '14d 6h' },
      { name: 'postgresql.service', status: 'active (running)', pid: 2190, memory: '4.8 GB', cpu: '11.5%', uptime: '14d 6h' },
      { name: 'infra-agent-telemetry', status: 'active (running)', pid: 3412, memory: '34.6 MB', cpu: '0.2%', uptime: '14d 6h' },
      { name: 'systemd-journald', status: 'active (running)', pid: 489, memory: '68.0 MB', cpu: '0.1%', uptime: '14d 6h' },
      { name: 'sshd.service', status: 'active (running)', pid: 820, memory: '12.4 MB', cpu: '0.0%', uptime: '14d 6h' },
    ];

    const diskTotal = server.storage?.diskTotalGb ?? 50;
    const diskUsed = server.storage?.diskUsedGb ?? 20;
    const diskPercent = server.metricsSummary?.diskUsage ?? 40;
    const filesystem = [
      { filesystem: '/dev/nvme0n1p1', mount: '/', size: `${diskTotal}G`, used: `${diskUsed}G`, avail: `${Math.max(0, diskTotal - diskUsed)}G`, usePercent: `${diskPercent}%` },
      { filesystem: 'tmpfs', mount: '/run', size: '3.2G', used: '48M', avail: '3.1G', usePercent: '2%' },
      { filesystem: '/dev/nvme0n1p2', mount: '/var/lib/docker', size: '100G', used: '32G', avail: '68G', usePercent: '32%' },
      { filesystem: '/dev/nvme1n1', mount: '/data/persistent', size: '500G', used: '194G', avail: '306G', usePercent: '39%' },
    ];

    const activeProcesses = [
      { pid: 2190, user: 'postgres', cpu: 11.5, mem: 28.4, command: 'postgres: checkpointer' },
      { pid: 1488, user: 'root', cpu: 4.2, mem: 8.5, command: 'dockerd --config-file=/etc/docker/daemon.json' },
      { pid: 3820, user: 'node', cpu: 3.8, mem: 6.2, command: 'node /app/dist/cluster-worker.js' },
      { pid: 1042, user: 'www-data', cpu: 0.8, mem: 1.1, command: 'nginx: worker process' },
      { pid: 3412, user: 'infra', cpu: 0.2, mem: 0.4, command: 'infra-agent --daemon --port=9100' },
    ];

    const pubIp = server.network?.publicIp || server.hostname || '139.59.74.30';
    const cleanName = (server.name || 'node').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const defaultSites = [
      {
        _id: new mongoose.Types.ObjectId(),
        domain: `api.${cleanName}.cloud`,
        serverEngine: server.webServer?.type || 'Nginx',
        port: 443,
        ssl: true,
        sslProvider: "Let's Encrypt (Auto-renewing)",
        sslExpiry: new Date(Date.now() + 64 * 24 * 3600 * 1000),
        rootPath: '/var/www/api',
        proxyPass: 'http://127.0.0.1:5000',
        phpVersion: 'Node.js 20 LTS',
        status: 'Active',
        httpStatus: 200,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        domain: `app.${cleanName}.cloud`,
        serverEngine: server.webServer?.type || 'Nginx',
        port: 443,
        ssl: true,
        sslProvider: "Let's Encrypt (Auto-renewing)",
        sslExpiry: new Date(Date.now() + 45 * 24 * 3600 * 1000),
        rootPath: '/var/www/frontend/dist',
        proxyPass: 'None (Static HTML/SPA)',
        phpVersion: 'Static SPA',
        status: 'Active',
        httpStatus: 200,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        domain: pubIp,
        serverEngine: server.webServer?.type || 'Nginx',
        port: 80,
        ssl: false,
        sslProvider: 'None',
        rootPath: '/var/www/html',
        proxyPass: 'None',
        phpVersion: 'PHP 8.2-FPM',
        status: 'Active',
        httpStatus: 200,
      },
    ];

    const websites = server.websites && server.websites.length > 0 ? server.websites : defaultSites;
    const webServer = server.webServer?.type
      ? server.webServer
      : {
          type: 'Nginx',
          version: 'nginx/1.24.0 (Ubuntu)',
          status: 'active (running)',
          mainPort: 80,
          sslPort: 443,
          configPath: '/etc/nginx/nginx.conf',
          activeConnections: 142,
          requestsPerSecond: 28.4,
        };

    res.json({
      success: true,
      data: {
        ...server.toObject(),
        webServer,
        websites,
        alerts,
        operations,
        systemInsights: {
          runningServices,
          filesystem,
          activeProcesses,
          webServer,
          websites,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new server
// @route   POST /api/servers
// @access  Private
const createServer = async (req, res, next) => {
  try {
    const {
      clientId,
      projectId,
      environmentId,
      name,
      hostname,
      provider,
      region,
      instanceType,
      serverRole,
      status,
      os,
      compute,
      storage,
      network,
      tags,
    } = req.body;

    const server = await Server.create({
      clientId,
      projectId,
      environmentId,
      name,
      hostname: hostname || `${name.toLowerCase().replace(/\s+/g, '-')}.infra.local`,
      provider: provider || 'AWS',
      region: region || 'us-east-1',
      instanceType: instanceType || 'c6i.xlarge',
      serverRole: serverRole || 'Application Node',
      status: status || 'healthy',
      os: os || 'Ubuntu 22.04 LTS (GNU/Linux 5.15.0-x86_64)',
      compute: {
        vcpu: compute?.vcpu || 4,
        ramGb: compute?.ramGb || 16,
        arch: compute?.arch || 'x86_64',
      },
      storage: {
        diskTotalGb: storage?.diskTotalGb || 250,
        diskUsedGb: storage?.diskUsedGb || 65,
        mountPoint: storage?.mountPoint || '/dev/nvme0n1p1 on /',
      },
      network: {
        publicIp: network?.publicIp || `198.51.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 250 + 2)}`,
        privateIp: network?.privateIp || `10.0.${Math.floor(Math.random() * 20 + 1)}.${Math.floor(Math.random() * 250 + 2)}`,
        macAddress: network?.macAddress || '02:42:0a:00:0c:54',
        incomingMbps: network?.incomingMbps || 42.0,
        outgoingMbps: network?.outgoingMbps || 68.0,
      },
      agent: {
        version: 'v2.4.1-enterprise',
        lastHeartbeat: new Date(),
        status: 'online',
        port: 9100,
      },
      metricsSummary: {
        cpuUsage: Math.floor(Math.random() * 30 + 15),
        memoryUsage: Math.floor(Math.random() * 35 + 30),
        diskUsage: Math.floor((storage?.diskUsedGb || 65) / (storage?.diskTotalGb || 250) * 100),
        uptimeDays: Number((Math.random() * 30 + 1).toFixed(1)),
        loadAvg: [0.42, 0.38, 0.35],
      },
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : ['production', 'web']),
    });

    await logAudit({
      req,
      action: 'SERVER_CREATE',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      status: 'Success',
      details: { provider: server.provider, region: server.region, ip: server.network.publicIp },
    });

    res.status(201).json({
      success: true,
      data: server,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update server
// @route   PUT /api/servers/:id
// @access  Private
const updateServer = async (req, res, next) => {
  try {
    let server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    if (req.body.tags && typeof req.body.tags === 'string') {
      req.body.tags = req.body.tags.split(',').map(t => t.trim());
    }
    if (typeof req.body.allowedServices === 'string') {
      req.body.allowedServices = req.body.allowedServices.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(req.body.allowedServices) && !req.body.allowedServices.every((s) => /^[a-zA-Z0-9@._-]{1,64}$/.test(s))) {
      return res.status(400).json({ success: false, error: 'Allowed services must be plain service names like nginx or app.service' });
    }

    // Fields owned by the agent, the operation engine, integrations or billing — never set from this form
    const update = { ...req.body };
    ['agent', 'operationLock', 'providerRef', 'cost', 'metricsSummary', '_id', 'createdAt', 'updatedAt'].forEach((f) => delete update[f]);

    server = await Server.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    await logAudit({
      req,
      action: 'SERVER_UPDATE',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      status: 'Success',
      details: req.body,
    });

    res.json({
      success: true,
      data: server,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete server
// @route   DELETE /api/servers/:id
// @access  Private
const deleteServer = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // Clean up related alerts and operations
    await Alert.deleteMany({ serverId: server._id });
    await Operation.deleteMany({ serverId: server._id });
    await server.deleteOne();

    await logAudit({
      req,
      action: 'SERVER_DELETE',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      status: 'Success',
    });

    res.json({
      success: true,
      data: {},
      message: 'Server de-provisioned and removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a website / virtual host to this server
// @route   POST /api/servers/:id/websites
const addWebsiteToServer = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    const { domain, serverEngine, port, ssl, rootPath, proxyPass, phpVersion, status } = req.body;
    if (!domain) return res.status(400).json({ success: false, error: 'Domain name is required' });

    const newSite = {
      domain: domain.trim(),
      serverEngine: serverEngine || server.webServer?.type || 'Nginx',
      port: Number(port) || (ssl !== false ? 443 : 80),
      ssl: ssl !== false,
      sslProvider: ssl !== false ? "Let's Encrypt" : 'None',
      sslExpiry: ssl !== false ? new Date(Date.now() + 90 * 24 * 3600 * 1000) : undefined,
      rootPath: rootPath || '/var/www/html',
      proxyPass: proxyPass || undefined,
      phpVersion: phpVersion || 'None',
      status: status || 'Active',
      httpStatus: 200,
    };

    server.websites.push(newSite);
    await server.save();

    await logAudit({
      req,
      action: 'SERVER_WEBSITE_ADDED',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: `${server.name} (${domain})`,
      details: newSite,
    });

    res.json({ success: true, data: server.websites });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a website / virtual host from this server
// @route   DELETE /api/servers/:id/websites/:websiteId
const deleteWebsiteFromServer = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    server.websites = server.websites.filter((w) => String(w._id) !== req.params.websiteId);
    await server.save();

    await logAudit({
      req,
      action: 'SERVER_WEBSITE_REMOVED',
      resourceType: 'Server',
      resourceId: server._id,
      resourceName: server.name,
      details: { websiteId: req.params.websiteId },
    });

    res.json({ success: true, data: server.websites });
  } catch (error) {
    next(error);
  }
};

// @desc    Update web server configuration (Nginx/Apache)
// @route   PUT /api/servers/:id/web-server
const updateWebServerInfo = async (req, res, next) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const { type, version, status, mainPort, sslPort, configPath } = req.body;
    server.webServer = server.webServer || {};
    if (type) server.webServer.type = type;
    if (version) server.webServer.version = version;
    if (status) server.webServer.status = status;
    if (mainPort) server.webServer.mainPort = mainPort;
    if (sslPort) server.webServer.sslPort = sslPort;
    if (configPath) server.webServer.configPath = configPath;

    await server.save();
    res.json({ success: true, data: server.webServer });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  addWebsiteToServer,
  deleteWebsiteFromServer,
  updateWebServerInfo,
};
