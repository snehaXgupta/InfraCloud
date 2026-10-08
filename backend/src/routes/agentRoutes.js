const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const Server = require('../models/Server');
const { requireAgentToken } = require('../services/agentAuth');
const { evaluateSample } = require('../services/thresholdAlerts');

const NODE_EXPORTER_VERSION = '1.8.2';
const VMAGENT_VERSION = 'v1.102.1';

// Generic installer: contains no secrets. The panel URL and the server's agent token are passed
// as environment variables by the command shown in the UI:
//   curl -fsSL <panel>/api/agent/install.sh | sudo SMP_URL=<panel> SMP_TOKEN=<token> bash
const INSTALL_SCRIPT = `#!/usr/bin/env bash
# Server Management Platform — host agent installer
# Installs node_exporter (metrics, localhost only), vmagent (pushes metrics to the panel)
# and infra-agent (heartbeat) as systemd services. No inbound ports are opened.
set -euo pipefail

: "\${SMP_URL:?SMP_URL is required (panel URL)}"
: "\${SMP_TOKEN:?SMP_TOKEN is required (agent token from the panel)}"
SMP_URL="\${SMP_URL%/}"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo)." >&2; exit 1; fi
command -v systemctl >/dev/null || { echo "systemd is required." >&2; exit 1; }

case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

step() { printf '\\n\\033[1;36m==> %s\\033[0m\\n' "$1"; }

step "Checking panel connectivity"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $SMP_TOKEN" -H 'Content-Type: application/json' -d '{}' "$SMP_URL/api/agent/heartbeat" || true)
if [ "$code" = "401" ]; then echo "Agent token rejected by $SMP_URL (expired or revoked?)" >&2; exit 1; fi
if [ "$code" = "000" ]; then echo "Cannot reach $SMP_URL from this host" >&2; exit 1; fi

step "Installing Node.js runtime (for infra-agent)"
if ! command -v node >/dev/null; then
  if command -v apt-get >/dev/null; then apt-get update -y -q && apt-get install -y -q nodejs
  elif command -v dnf >/dev/null; then dnf install -y nodejs
  elif command -v yum >/dev/null; then yum install -y nodejs
  else echo "Install Node.js 18+ and re-run." >&2; exit 1; fi
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p /etc/infra-agent /opt/infra-agent /var/lib/vmagent /var/lib/node_exporter
umask 077; printf '%s' "$SMP_TOKEN" > /etc/infra-agent/token; umask 022

step "Installing node_exporter ${NODE_EXPORTER_VERSION}"
id node_exporter >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter
curl -fsSL "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-$ARCH.tar.gz" | tar xz -C "$TMP"
install -m 0755 "$TMP/node_exporter-${NODE_EXPORTER_VERSION}.linux-$ARCH/node_exporter" /usr/local/bin/node_exporter

step "Installing vmagent ${VMAGENT_VERSION}"
curl -fsSL "https://github.com/VictoriaMetrics/VictoriaMetrics/releases/download/${VMAGENT_VERSION}/vmutils-linux-$ARCH-${VMAGENT_VERSION}.tar.gz" | tar xz -C "$TMP" vmagent-prod
install -m 0755 "$TMP/vmagent-prod" /usr/local/bin/vmagent

step "Installing infra-agent"
curl -fsSL "$SMP_URL/api/agent/script" -o /opt/infra-agent/infra-agent.js

cat > /etc/infra-agent/scrape.yml <<'EOF'
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["127.0.0.1:9100"]
EOF

cat > /etc/systemd/system/node_exporter.service <<'EOF'
[Unit]
Description=Prometheus node_exporter
After=network-online.target
[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter --web.listen-address=127.0.0.1:9100 --collector.textfile.directory=/var/lib/node_exporter
Restart=always
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/vmagent.service <<EOF
[Unit]
Description=vmagent metrics shipper
After=network-online.target node_exporter.service
[Service]
ExecStart=/usr/local/bin/vmagent -promscrape.config=/etc/infra-agent/scrape.yml -remoteWrite.url=$SMP_URL/ingest/metrics -remoteWrite.bearerTokenFile=/etc/infra-agent/token -remoteWrite.forcePromProto=true -remoteWrite.tmpDataPath=/var/lib/vmagent -httpListenAddr=127.0.0.1:8429
Restart=always
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/infra-agent.service <<EOF
[Unit]
Description=Server Management Platform heartbeat agent
After=network-online.target
[Service]
ExecStart=$(command -v node) /opt/infra-agent/infra-agent.js --endpoint $SMP_URL --token-file /etc/infra-agent/token --silent
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

step "Starting services"
systemctl daemon-reload
systemctl enable --now node_exporter vmagent infra-agent
systemctl restart node_exporter vmagent infra-agent
sleep 3
for svc in node_exporter vmagent infra-agent; do
  printf '  %-14s %s\\n' "$svc" "$(systemctl is-active $svc)"
done

printf '\\n\\033[1;32mDone. This server will appear as live in the panel within ~30 seconds.\\033[0m\\n'
`;

/**
 * @desc    Generic host installer (no secrets inside)
 * @route   GET /api/agent/install.sh
 * @access  Public
 */
router.get('/install.sh', (req, res) => {
  res.type('text/x-shellscript').send(INSTALL_SCRIPT);
});

/**
 * @desc    Heartbeat agent source
 * @route   GET /api/agent/script
 * @access  Public
 */
router.get('/script', (req, res) => {
  const agentPath = path.resolve(__dirname, '../../../telemetry/infra-agent.js');
  if (fs.existsSync(agentPath)) {
    return res.type('application/javascript').sendFile(agentPath);
  }
  res.status(404).send('// Agent script not found');
});

const clampPercent = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v * 10) / 10)) : undefined;

/**
 * @desc    Agent heartbeat with summary telemetry. The server is identified by the agent
 *          token, never by a client-supplied id.
 * @route   POST /api/agent/heartbeat
 * @access  Agent token (Authorization: Bearer <token>)
 */
router.post('/heartbeat', requireAgentToken, async (req, res) => {
  try {
    const server = await Server.findById(req.agentServerId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const { memoryTotalMb, diskTotalGb, diskUsedGb, loadAvg, uptimeSeconds, osKernel, agentVersion } = req.body || {};
    const cpu = clampPercent(req.body?.cpuUsage);
    const mem = clampPercent(req.body?.memoryUsage);
    const disk = clampPercent(req.body?.diskUsage);

    if (typeof agentVersion === 'string') server.set('agent.version', agentVersion.slice(0, 40));
    server.set('agent.lastHeartbeat', new Date());
    server.set('agent.status', 'online');
    server.set('agent.isLiveAgent', true);

    if (cpu !== undefined) {
      server.metricsSummary = {
        cpuUsage: cpu,
        memoryUsage: mem ?? server.metricsSummary?.memoryUsage,
        diskUsage: disk ?? server.metricsSummary?.diskUsage,
        uptimeDays: uptimeSeconds ? Math.round((uptimeSeconds / 86400) * 10) / 10 : server.metricsSummary?.uptimeDays,
        loadAvg: Array.isArray(loadAvg) ? loadAvg.slice(0, 3).map(Number) : server.metricsSummary?.loadAvg,
      };
      if (typeof osKernel === 'string') server.os = osKernel.slice(0, 200);
      if (memoryTotalMb > 0) server.compute.ramGb = Math.round(memoryTotalMb / 1024);
      if (diskTotalGb > 0) server.storage.diskTotalGb = diskTotalGb;
      if (diskUsedGb >= 0) server.storage.diskUsedGb = diskUsedGb;

      if (server.status !== 'maintenance') {
        server.status = await evaluateSample(server, { CPU: cpu, Memory: mem, Disk: disk });
      }
    } else if (server.status === 'offline') {
      server.status = 'healthy';
    }

    await server.save();

    res.json({ success: true, serverStatus: server.status, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Agent Heartbeat Error]', err);
    res.status(500).json({ success: false, error: 'Heartbeat processing failed' });
  }
});

module.exports = router;
