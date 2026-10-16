const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Server must belong to a Client'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Server must belong to a Project'],
    },
    environmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
      required: [true, 'Server must belong to an Environment'],
    },
    name: {
      type: String,
      required: [true, 'Please provide server name'],
      trim: true,
    },
    hostname: {
      type: String,
      required: [true, 'Please provide hostname'],
      trim: true,
    },
    provider: {
      type: String,
      enum: ['AWS', 'GCP', 'Azure', 'DigitalOcean', 'Vultr', 'Hetzner', 'On-Premise'],
      default: 'AWS',
    },
    region: {
      type: String,
      default: 'us-east-1',
    },
    instanceType: {
      type: String,
      default: 'c6i.xlarge',
    },
    serverRole: {
      type: String,
      enum: ['Primary Database', 'Replica Database', 'API Gateway', 'Application Node', 'Worker Queue', 'Cache Cluster', 'Storage Node'],
      default: 'Application Node',
    },
    status: {
      type: String,
      enum: ['healthy', 'warning', 'critical', 'offline', 'maintenance'],
      default: 'healthy',
    },
    os: {
      type: String,
      default: 'Ubuntu 22.04 LTS (GNU/Linux 5.15.0-x86_64)',
    },
    compute: {
      vcpu: { type: Number, default: 4 },
      ramGb: { type: Number, default: 16 },
      arch: { type: String, default: 'x86_64' },
    },
    storage: {
      diskTotalGb: { type: Number, default: 250 },
      diskUsedGb: { type: Number, default: 95 },
      mountPoint: { type: String, default: '/dev/nvme0n1p1 on /' },
    },
    network: {
      publicIp: { type: String, default: '198.51.100.42' },
      privateIp: { type: String, default: '10.0.12.84' },
      macAddress: { type: String, default: '02:42:0a:00:0c:54' },
      incomingMbps: { type: Number, default: 48.5 },
      outgoingMbps: { type: Number, default: 82.1 },
    },
    agent: {
      version: { type: String, default: 'v2.4.1-enterprise' },
      lastHeartbeat: { type: Date, default: Date.now },
      status: { type: String, enum: ['online', 'stale', 'unreachable'], default: 'online' },
      isLiveAgent: { type: Boolean, default: false },
      capabilities: [{ type: String }], // e.g. 'jobs', 'replication' — reported by the agent
      bootTime: { type: Date }, // derived from reported uptime; proves a reboot happened
      port: { type: Number, default: 9100 },
    },
    metricsSummary: {
      cpuUsage: { type: Number, default: 28 },
      memoryUsage: { type: Number, default: 54 },
      diskUsage: { type: Number, default: 38 },
      uptimeDays: { type: Number, default: 42.6 },
      loadAvg: [{ type: Number }],
    },
    tags: [
      {
        type: String,
      },
    ],
    // Link to the instance in a provider account (needed for resize / import)
    providerRef: {
      integrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration' },
      instanceId: { type: String },
      linkedAt: { type: Date },
    },
    // Manual monthly price set by Billing; overrides catalog estimates (discovery doc §11)
    cost: {
      monthlyRate: { type: Number, min: 0 },
      currency: { type: String },
      updatedAt: { type: Date },
    },
    // Set while an operation runs on this server (per-server lock, discovery doc §20)
    operationLock: {
      type: { type: String },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
      operationId: { type: mongoose.Schema.Types.ObjectId },
    },
    // Services an operator may restart on this server (Service Restart operation, §8)
    allowedServices: [{ type: String, trim: true }],
    // Web server detection & hosted virtual hosts
    webServer: {
      type: { type: String, enum: ['Nginx', 'Apache', 'Nginx + Apache (Reverse Proxy)', 'Caddy', 'LiteSpeed', 'Node.js', 'None'], default: 'Nginx' },
      version: { type: String, default: 'nginx/1.24.0 (Ubuntu)' },
      status: { type: String, default: 'active (running)' },
      mainPort: { type: Number, default: 80 },
      sslPort: { type: Number, default: 443 },
      configPath: { type: String, default: '/etc/nginx/nginx.conf' },
      activeConnections: { type: Number, default: 142 },
      requestsPerSecond: { type: Number, default: 28.4 },
    },
    websites: [
      {
        domain: { type: String, required: true },
        serverEngine: { type: String, default: 'Nginx' },
        port: { type: Number, default: 80 },
        ssl: { type: Boolean, default: true },
        sslProvider: { type: String, default: "Let's Encrypt" },
        sslExpiry: { type: Date },
        rootPath: { type: String, default: '/var/www/html' },
        proxyPass: { type: String },
        phpVersion: { type: String },
        status: { type: String, enum: ['Active', 'Suspended', 'Error'], default: 'Active' },
        httpStatus: { type: Number, default: 200 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Server', serverSchema);
