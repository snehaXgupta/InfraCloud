const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: __dirname + '/../../.env' });

const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Environment = require('../models/Environment');
const Server = require('../models/Server');
const Alert = require('../models/Alert');
const Operation = require('../models/Operation');
const AuditLog = require('../models/AuditLog');

const seedData = async () => {
  // The seed wipes every collection and creates accounts with published passwords.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('[Seed] Refusing to seed a production database. Use `npm run create-admin` instead,');
    console.error('       or set ALLOW_DEMO_SEED=true for a throwaway demo instance.');
    process.exit(1);
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform';
    console.log(`[Seed] Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('[Seed] Purging existing collections...');
    await Promise.all([
      User.deleteMany(),
      Client.deleteMany(),
      Project.deleteMany(),
      Environment.deleteMany(),
      Server.deleteMany(),
      Alert.deleteMany(),
      Operation.deleteMany(),
      AuditLog.deleteMany(),
    ]);

    console.log('[Seed] Creating Users...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
    const devopsPasswordHash = await bcrypt.hash('DevOps@123', salt);
    const auditorPasswordHash = await bcrypt.hash('Auditor@123', salt);
    const clientAdminPasswordHash = await bcrypt.hash('Client@123', salt);
    const viewerPasswordHash = await bcrypt.hash('Viewer@123', salt);
    const billingPasswordHash = await bcrypt.hash('Billing@123', salt);

    const adminUser = await User.create({
      name: 'Alex Rivera (Lead Architect)',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'Platform Admin',
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });

    const devopsUser = await User.create({
      name: 'Sarah Chen (SRE Lead)',
      email: 'devops@example.com',
      passwordHash: devopsPasswordHash,
      role: 'DevOps / Infrastructure',
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    });

    const auditorUser = await User.create({
      name: 'Marcus Vance (Compliance Officer)',
      email: 'auditor@example.com',
      passwordHash: auditorPasswordHash,
      role: 'Auditor',
      status: 'active',
    });

    const clientAdminUser = await User.create({
      name: 'Elena Rostova (Client Partner)',
      email: 'client.admin@example.com',
      passwordHash: clientAdminPasswordHash,
      role: 'Client Admin',
      status: 'active',
    });

    console.log('[Seed] Creating Clients...');
    const client1 = await Client.create({
      name: 'Acme Cloud Systems',
      description: 'Global SaaS enterprise providing low-latency distributed media pipeline.',
      status: 'active',
      contactEmail: 'infra@acmecloud.io',
      tier: 'Enterprise',
      sla: '99.99% Mission Critical',
      billingReference: 'INV-2026-ACM-9102',
    });

    const client2 = await Client.create({
      name: 'Nexus FinTech Infrastructure',
      description: 'PCI-DSS certified core banking & real-time transaction processing network.',
      status: 'active',
      contactEmail: 'security-ops@nexusfin.com',
      tier: 'Enterprise',
      sla: '99.999% Fault Tolerant',
      billingReference: 'INV-2026-NEX-4419',
    });

    // Scope assignments (discovery doc §12): DevOps operates both clients, the client-side
    // accounts only see Nexus FinTech.
    devopsUser.assignedClients = [client1._id, client2._id];
    clientAdminUser.assignedClients = [client2._id];
    await Promise.all([devopsUser.save(), clientAdminUser.save()]);
    await User.create({
      name: 'Ravi Menon (Client Viewer)',
      email: 'viewer@example.com',
      passwordHash: viewerPasswordHash,
      role: 'Client Viewer',
      status: 'active',
      assignedClients: [client2._id],
    });
    await User.create({
      name: 'Priya Nair (Finance)',
      email: 'billing@example.com',
      passwordHash: billingPasswordHash,
      role: 'Billing / Finance',
      status: 'active',
      assignedClients: [client1._id, client2._id],
    });

    console.log('[Seed] Creating Projects...');
    const project1 = await Project.create({
      clientId: client2._id,
      name: 'Core Payment Gateway',
      description: 'Zero-downtime card processing and ISO 8583 settlement microservices.',
      repositoryUrl: 'https://github.com/nexusfin/payment-core',
      techStack: ['Go', 'PostgreSQL 16', 'Kafka', 'Redis Sentinel'],
      status: 'active',
      leadDevOps: 'Sarah Chen',
    });

    const project2 = await Project.create({
      clientId: client1._id,
      name: 'Realtime Streaming Engine',
      description: 'Distributed WebRTC & HLS transcoding workers with automated scale-out.',
      repositoryUrl: 'https://github.com/acmecloud/transcoder-engine',
      techStack: ['Rust', 'FFmpeg', 'Docker', 'Kubernetes'],
      status: 'active',
      leadDevOps: 'Alex Rivera',
    });

    const project3 = await Project.create({
      clientId: client1._id,
      name: 'Customer Portal Service',
      description: 'High-throughput customer account management and analytics dashboard backend.',
      repositoryUrl: 'https://github.com/acmecloud/portal-api',
      techStack: ['Node.js', 'Express', 'React', 'MongoDB Enterprise'],
      status: 'active',
      leadDevOps: 'Alex Rivera',
    });

    console.log('[Seed] Creating Environments...');
    // Payment gateway envs
    const envPaymentProd = await Environment.create({
      projectId: project1._id,
      name: 'Production (US-East)',
      type: 'Production',
      status: 'healthy',
      clusterUrl: 'https://k8s-prod.us-east.nexusfin.internal:6443',
    });

    const envPaymentStaging = await Environment.create({
      projectId: project1._id,
      name: 'Staging Isolation Sandbox',
      type: 'Staging',
      status: 'healthy',
      clusterUrl: 'https://k8s-stg.nexusfin.internal:6443',
    });

    // Streaming engine envs
    const envStreamingProd = await Environment.create({
      projectId: project2._id,
      name: 'Production Media Edge',
      type: 'Production',
      status: 'healthy',
      clusterUrl: 'https://edge-cluster.acmecloud.io',
    });

    // Portal envs
    const envPortalProd = await Environment.create({
      projectId: project3._id,
      name: 'Production Primary',
      type: 'Production',
      status: 'healthy',
      clusterUrl: 'https://portal-cluster.acmecloud.io',
    });

    const envPortalDev = await Environment.create({
      projectId: project3._id,
      name: 'Development Sandbox',
      type: 'Development',
      status: 'healthy',
      clusterUrl: 'https://dev-k8s.acmecloud.io',
    });

    console.log('[Seed] Creating Servers & Droplets...');
    const servers = await Server.create([
      {
        clientId: client1._id,
        projectId: project2._id,
        environmentId: envStreamingProd._id,
        name: 'luxStag',
        hostname: 'luxstag.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-4vcpu-8gb',
        serverRole: 'Application Node',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS (x86_64)',
        compute: { vcpu: 4, ramGb: 8, arch: 'x86_64' },
        storage: { diskTotalGb: 80, diskUsedGb: 28, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '142.93.215.161', privateIp: '10.120.0.2', macAddress: '02:42:0a:00:01:2a', incomingMbps: 48.2, outgoingMbps: 65.5 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 28, memoryUsage: 45, diskUsage: 35, uptimeDays: 45.2, loadAvg: [0.45, 0.40, 0.38] },
        tags: ['droplet', 'bangalore', 'web'],
      },
      {
        clientId: client1._id,
        projectId: project2._id,
        environmentId: envStreamingProd._id,
        name: 'aptia-ems',
        hostname: 'aptia-ems.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-1vcpu-2gb',
        serverRole: 'Worker Queue',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS (x86_64)',
        compute: { vcpu: 1, ramGb: 2, arch: 'x86_64' },
        storage: { diskTotalGb: 50, diskUsedGb: 18, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '168.144.120.206', privateIp: '10.120.0.3', macAddress: '02:42:0a:00:02:0a', incomingMbps: 18.4, outgoingMbps: 24.8 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 22, memoryUsage: 54, diskUsage: 36, uptimeDays: 32.0, loadAvg: [0.25, 0.20, 0.18] },
        tags: ['droplet', 'ems', 'bangalore'],
      },
      {
        clientId: client2._id,
        projectId: project1._id,
        environmentId: envPaymentProd._id,
        name: 'Ekal-AK-EVFI',
        hostname: 'ekal-ak-evfi.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-4vcpu-8gb',
        serverRole: 'Primary Database',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS (x86_64)',
        compute: { vcpu: 4, ramGb: 8, arch: 'x86_64' },
        storage: { diskTotalGb: 160, diskUsedGb: 62, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '143.110.189.75', privateIp: '10.120.0.4', macAddress: '02:42:0a:01:02:0b', incomingMbps: 65.0, outgoingMbps: 85.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 38, memoryUsage: 62, diskUsage: 39, uptimeDays: 91.0, loadAvg: [0.65, 0.58, 0.52] },
        tags: ['droplet', 'database', 'evfi'],
      },
      {
        clientId: client2._id,
        projectId: project1._id,
        environmentId: envPaymentProd._id,
        name: 'Karyakarta-API',
        hostname: 'karyakarta-api.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-4vcpu-8gb',
        serverRole: 'API Gateway',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS (x86_64)',
        compute: { vcpu: 4, ramGb: 8, arch: 'x86_64' },
        storage: { diskTotalGb: 160, diskUsedGb: 48, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '168.144.71.244', privateIp: '10.120.0.5', macAddress: '42:01:0a:80:00:0e', incomingMbps: 54.4, outgoingMbps: 72.9 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 32, memoryUsage: 48, diskUsage: 30, uptimeDays: 60.5, loadAvg: [0.55, 0.48, 0.42] },
        tags: ['droplet', 'api', 'gateway'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalProd._id,
        name: 'EVFI',
        hostname: 'evfi-core.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-2vcpu-4gb',
        serverRole: 'Application Node',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS',
        compute: { vcpu: 2, ramGb: 4, arch: 'x86_64' },
        storage: { diskTotalGb: 50, diskUsedGb: 22, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '168.144.75.83', privateIp: '10.120.0.6', macAddress: '42:01:0a:84:00:04', incomingMbps: 30.0, outgoingMbps: 45.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 25, memoryUsage: 42, diskUsage: 44, uptimeDays: 78.1, loadAvg: [0.38, 0.32, 0.28] },
        tags: ['droplet', 'evfi', 'bangalore'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalProd._id,
        name: 'Harsh',
        hostname: 'harsh-svc.simpel.ai',
        provider: 'DigitalOcean',
        region: 'Bangalore 1',
        instanceType: 's-4vcpu-8gb',
        serverRole: 'Application Node',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS',
        compute: { vcpu: 4, ramGb: 8, arch: 'x86_64' },
        storage: { diskTotalGb: 50, diskUsedGb: 19, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '139.59.18.226', privateIp: '10.120.0.7', macAddress: '42:01:0a:84:00:05', incomingMbps: 35.0, outgoingMbps: 50.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 20, memoryUsage: 39, diskUsage: 38, uptimeDays: 52.1, loadAvg: [0.32, 0.28, 0.25] },
        tags: ['droplet', 'services'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalProd._id,
        name: 'Production API Server',
        hostname: 'portal-api-01.acmecloud.io',
        provider: 'AWS',
        region: 'us-west-2',
        instanceType: 'c6i.xlarge',
        serverRole: 'Application Node',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS',
        compute: { vcpu: 4, ramGb: 16, arch: 'x86_64' },
        storage: { diskTotalGb: 250, diskUsedGb: 88, mountPoint: '/dev/nvme0n1p1 on /' },
        network: { publicIp: '52.34.198.88', privateIp: '10.0.10.15', macAddress: '02:42:0a:00:0a:0f', incomingMbps: 48.0, outgoingMbps: 65.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 28, memoryUsage: 46, diskUsage: 35, uptimeDays: 56.4, loadAvg: [0.45, 0.40, 0.38] },
        tags: ['portal', 'api', 'express', 'production'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalProd._id,
        name: 'Worker Server (Redis / Queue)',
        hostname: 'redis-queue-01.acmecloud.io',
        provider: 'DigitalOcean',
        region: 'nyc3',
        instanceType: 's-4vcpu-8gb',
        serverRole: 'Cache Cluster',
        status: 'warning',
        os: 'Debian 12 Bookworm',
        compute: { vcpu: 4, ramGb: 8, arch: 'x86_64' },
        storage: { diskTotalGb: 160, diskUsedGb: 135, mountPoint: '/dev/vda1 on /' },
        network: { publicIp: '159.203.44.110', privateIp: '10.116.0.2', macAddress: 'fa:16:3e:44:11:02', incomingMbps: 35.0, outgoingMbps: 52.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 32, memoryUsage: 89, diskUsage: 84, uptimeDays: 91.2, loadAvg: [0.92, 0.85, 0.80] },
        tags: ['redis', 'queue', 'memory-pressure'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalProd._id,
        name: 'Storage Node (MinIO S3 Cluster)',
        hostname: 'storage-s3-01.acmecloud.io',
        provider: 'Hetzner',
        region: 'fsn1',
        instanceType: 'AX52-NVMe',
        serverRole: 'Storage Node',
        status: 'healthy',
        os: 'Alpine Linux 3.19 (Kernel 6.6.14-lts)',
        compute: { vcpu: 16, ramGb: 64, arch: 'x86_64' },
        storage: { diskTotalGb: 4000, diskUsedGb: 1820, mountPoint: '/dev/nvme0n1 on /mnt/minio-data' },
        network: { publicIp: '168.119.200.84', privateIp: '10.0.99.5', macAddress: '00:50:56:00:99:05', incomingMbps: 180.0, outgoingMbps: 290.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 18, memoryUsage: 42, diskUsage: 45, uptimeDays: 110.0, loadAvg: [0.28, 0.25, 0.20] },
        tags: ['minio', 's3', 'storage', 'hetzner'],
      },
      {
        clientId: client1._id,
        projectId: project3._id,
        environmentId: envPortalDev._id,
        name: 'Dev Sandbox Server',
        hostname: 'sandbox-01.internal.acmecloud.io',
        provider: 'On-Premise',
        region: 'local-dc1',
        instanceType: 'bare-metal-xeon',
        serverRole: 'Application Node',
        status: 'healthy',
        os: 'Ubuntu 22.04 LTS',
        compute: { vcpu: 8, ramGb: 32, arch: 'x86_64' },
        storage: { diskTotalGb: 500, diskUsedGb: 120, mountPoint: '/dev/sda1 on /' },
        network: { publicIp: '198.51.100.88', privateIp: '192.168.1.50', macAddress: '52:54:00:12:34:56', incomingMbps: 12.0, outgoingMbps: 8.0 },
        agent: { version: 'v2.4.1-enterprise', lastHeartbeat: new Date(), status: 'online', port: 9100 },
        metricsSummary: { cpuUsage: 14, memoryUsage: 35, diskUsage: 24, uptimeDays: 9.2, loadAvg: [0.15, 0.12, 0.10] },
        tags: ['development', 'sandbox', 'baremetal'],
      },
    ]);

    console.log('[Seed] Creating Alerts...');
    const alertCritical = await Alert.create({
      serverId: servers[4]._id, // Transcoder 01
      clientId: client1._id,
      projectId: project2._id,
      environmentId: envStreamingProd._id,
      severity: 'Critical',
      metric: 'CPU',
      currentValue: '96.2%',
      threshold: '>95% for 5m',
      status: 'active',
      message: 'Critical CPU saturation on Transcode Node 01 (96.2% usage exceeds 95% threshold)',
    });

    const alertDiskWarning = await Alert.create({
      serverId: servers[7]._id, // Redis Queue
      clientId: client1._id,
      projectId: project3._id,
      environmentId: envPortalProd._id,
      severity: 'Warning',
      metric: 'Disk',
      currentValue: '84.4%',
      threshold: '>80%',
      status: 'active',
      message: 'High storage consumption on Redis Worker Node (/dev/vda1 is 84.4% full)',
    });

    const alertMemWarning = await Alert.create({
      serverId: servers[7]._id, // Redis Queue
      clientId: client1._id,
      projectId: project3._id,
      environmentId: envPortalProd._id,
      severity: 'Warning',
      metric: 'Memory',
      currentValue: '89.1%',
      threshold: '>85%',
      status: 'active',
      message: 'Elevated resident memory usage on BullMQ worker process',
    });

    const alertReplicaWarning = await Alert.create({
      serverId: servers[2]._id, // DB Replica
      clientId: client2._id,
      projectId: project1._id,
      environmentId: envPaymentProd._id,
      severity: 'Warning',
      metric: 'Memory',
      currentValue: '88.0%',
      threshold: '>85%',
      status: 'acknowledged',
      acknowledgedBy: devopsUser._id,
      acknowledgedAt: new Date(Date.now() - 1000 * 60 * 25),
      message: 'High shared buffer memory utilization during index re-build',
    });

    const alertResolved = await Alert.create({
      serverId: servers[0]._id, // Payment API Gateway 01
      clientId: client2._id,
      projectId: project1._id,
      environmentId: envPaymentProd._id,
      severity: 'Warning',
      metric: 'Network',
      currentValue: '128.5 Mbps',
      threshold: '>120 Mbps',
      status: 'resolved',
      acknowledgedBy: adminUser._id,
      acknowledgedAt: new Date(Date.now() - 1000 * 60 * 180),
      resolvedAt: new Date(Date.now() - 1000 * 60 * 60),
      message: 'Network egress burst resolved after rate-limiter sync',
    });

    console.log('[Seed] Creating Controlled Operations...');
    await Operation.create([
      {
        serverId: servers[0]._id,
        operationType: 'Health Check',
        requestedBy: adminUser._id,
        status: 'Succeeded',
        output: `[${new Date(Date.now() - 1000 * 60 * 15).toISOString()}] Operation 'Health Check' dispatched by Alex Rivera\n[${new Date(Date.now() - 1000 * 60 * 15 + 300).toISOString()}] [INIT] Handshake verified with agent v2.4.1\n[${new Date(Date.now() - 1000 * 60 * 15 + 600).toISOString()}] [PROBE] All 14 Linux kernel health parameters verified\n[${new Date(Date.now() - 1000 * 60 * 15 + 1200).toISOString()}] [SUCCESS] Subsystem health verified nominal.`,
        executionTimeMs: 1240,
        completedAt: new Date(Date.now() - 1000 * 60 * 15),
      },
      {
        serverId: servers[2]._id,
        operationType: 'Sync',
        requestedBy: devopsUser._id,
        status: 'Succeeded',
        output: `[${new Date(Date.now() - 1000 * 60 * 45).toISOString()}] Operation 'Sync' dispatched by Sarah Chen\n[${new Date(Date.now() - 1000 * 60 * 45 + 400).toISOString()}] [SYNC] Fetching state manifest from control plane...\n[${new Date(Date.now() - 1000 * 60 * 45 + 900).toISOString()}] [APPLY] Configuration synchronized (0 drift).\n[${new Date(Date.now() - 1000 * 60 * 45 + 1500).toISOString()}] [SUCCESS] Manifest version 1.4.9 applied.`,
        executionTimeMs: 1510,
        completedAt: new Date(Date.now() - 1000 * 60 * 45),
      },
      {
        serverId: servers[7]._id,
        operationType: 'Cleanup',
        requestedBy: devopsUser._id,
        status: 'Succeeded',
        output: `[${new Date(Date.now() - 1000 * 60 * 120).toISOString()}] Operation 'Cleanup' dispatched by Sarah Chen\n[${new Date(Date.now() - 1000 * 60 * 120 + 500).toISOString()}] [PURGE] Removed 840 MB of journal logs\n[${new Date(Date.now() - 1000 * 60 * 120 + 1600).toISOString()}] [SUCCESS] 2.1 GB storage space reclaimed.`,
        executionTimeMs: 1620,
        completedAt: new Date(Date.now() - 1000 * 60 * 120),
      },
    ]);

    console.log('[Seed] Creating Audit Logs...');
    await AuditLog.create([
      {
        userId: adminUser._id,
        userName: adminUser.name,
        userEmail: adminUser.email,
        userRole: adminUser.role,
        action: 'USER_LOGIN_SUCCESS',
        resourceType: 'Auth',
        resourceName: 'admin@example.com',
        status: 'Success',
        ipAddress: '198.51.100.12',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        details: { method: 'JWT_BEARER', region: 'US' },
        createdAt: new Date(Date.now() - 1000 * 60 * 20),
      },
      {
        userId: devopsUser._id,
        userName: devopsUser.name,
        userEmail: devopsUser.email,
        userRole: devopsUser.role,
        action: 'OPERATION_DISPATCHED',
        resourceType: 'Operation',
        resourceName: 'Sync on Database Replica (Standby 01)',
        status: 'Success',
        ipAddress: '198.51.100.18',
        details: { operationType: 'Sync', targetServer: 'pg-replica-01.db.nexusfin.internal' },
        createdAt: new Date(Date.now() - 1000 * 60 * 45),
      },
      {
        userId: devopsUser._id,
        userName: devopsUser.name,
        userEmail: devopsUser.email,
        userRole: devopsUser.role,
        action: 'ALERT_ACKNOWLEDGE',
        resourceType: 'Alert',
        resourceName: 'Memory Alert (Warning) on Database Replica',
        status: 'Success',
        ipAddress: '198.51.100.18',
        details: { metric: 'Memory', currentValue: '88.0%' },
        createdAt: new Date(Date.now() - 1000 * 60 * 25),
      },
      {
        userId: adminUser._id,
        userName: adminUser.name,
        userEmail: adminUser.email,
        userRole: adminUser.role,
        action: 'SERVER_CREATE',
        resourceType: 'Server',
        resourceName: 'Payment API Gateway 01',
        status: 'Success',
        ipAddress: '198.51.100.12',
        details: { provider: 'AWS', region: 'us-east-1', instanceType: 'c6i.2xlarge' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      },
    ]);

    console.log('==================================================');
    console.log('[Seed] Database seeded successfully!');
    console.log('Default Admin Account:');
    console.log('  Email:    admin@example.com');
    console.log('  Password: Admin@123');
    console.log('  Role:     Platform Admin');
    console.log('Additional Dev Accounts:');
    console.log('  devops@example.com / DevOps@123 (DevOps / Infrastructure)');
    console.log('  auditor@example.com / Auditor@123 (Auditor)');
    console.log('  client.admin@example.com / Client@123 (Client Admin, Nexus FinTech only)');
    console.log('  viewer@example.com / Viewer@123 (Client Viewer, Nexus FinTech only)');
    console.log('  billing@example.com / Billing@123 (Billing / Finance, both clients)');
    console.log('==================================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedData();
