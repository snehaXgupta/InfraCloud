const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { isProduction, CLIENT_URL } = require('./config/env');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const { isPrometheusUp } = require('./services/prometheusService');
const { startHeartbeatSweeper } = require('./services/thresholdAlerts');
const { startCostIngestion } = require('./services/costService');
const { startResizeWorker } = require('./services/resizeWorker');
const { loadSyncedPlans } = require('./services/planCatalog');
const { startPlanSync } = require('./controllers/integrationController');

// Connect to Database
connectDB();

const app = express();

// Behind Caddy/nginx: trust the first proxy so req.ip and req.protocol are the client's.
app.set('trust proxy', 1);

// CSP is left to the reverse proxy; the SPA uses inline styles from its chart library.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Prometheus remote_write gateway (raw protobuf body, agent-token auth) — mounted before JSON parsing
app.use('/ingest', require('./routes/ingestRoutes'));

// Middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// The production build is served from this same origin; cross-origin access is only for the dev server.
const allowedOrigins = CLIENT_URL.split(',').map((o) => o.trim().replace(/\/$/, ''));
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
  })
);

app.use(morgan(isProduction ? 'combined' : 'dev'));

// Brute-force protection on credential endpoints
app.use(
  ['/api/auth/login', '/api/auth/register'],
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false })
);

// Health check endpoint (used by Docker/uptime monitors)
app.get('/api/health', async (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const prometheus = (await isPrometheusUp()) ? 'up' : 'down';
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'healthy' : 'degraded',
    service: 'Server Management Platform Control Plane',
    version: '1.1.0',
    dependencies: { database, prometheus },
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/environments', require('./routes/environmentRoutes'));
app.use('/api/servers', require('./routes/serverRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/operations', require('./routes/operationRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/agent', require('./routes/agentRoutes'));
app.use('/api/costs', require('./routes/costRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/integrations', require('./routes/integrationRoutes'));
app.use('/api/resize-requests', require('./routes/resizeRoutes'));

// Global 404 handler for unhandled API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ingest')) {
    return res.status(404).json({
      success: false,
      error: `API route ${req.originalUrl} not found on control plane`,
    });
  }
  next();
});

// Serve the built React app (single-origin deployment). SPA routes fall back to index.html.
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(STATIC_DIR, 'index.html'))) {
  app.use(express.static(STATIC_DIR, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|ingest|ws).*/, (req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));
  console.log(`[Server] Serving frontend from ${STATIC_DIR}`);
}

// Central Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Infrastructure Control Plane running on port ${PORT} (0.0.0.0)`);
  console.log(`[Server] Health endpoint: http://localhost:${PORT}/api/health`);
});

// Initialize SSH WebSocket Bridge for Browser Terminal Console (disabled unless ENABLE_WEB_TERMINAL=true)
const { initSSHBridge } = require('./services/sshBridge');
initSSHBridge(server);

// Mark silent live agents offline and raise heartbeat alerts
startHeartbeatSweeper();

// Hourly cost accrual into cost_snapshots (pages never call billing APIs)
startCostIngestion();

// Provider plan prices (synced daily from provider APIs) and the resize job runner
loadSyncedPlans().catch((err) => console.error('[Plan Catalog]', err.message));
startPlanSync();
startResizeWorker();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`[Unhandled Rejection] ${err.message}`);
});

module.exports = app;
