#!/usr/bin/env node
/**
 * infra-agent — Server Management Platform host agent
 *
 * Runs on each managed server (installed as a systemd service by /api/agent/install.sh).
 *  • Heartbeat every few seconds: CPU / memory / disk summary, uptime, version, capabilities.
 *  • Operations (discovery doc §8): the panel's heartbeat reply may carry a job. The agent runs
 *    ONLY its own built-in script for that job's catalog key — no command text is ever accepted
 *    from the network — after verifying the job's signature. Output is streamed back, then a
 *    result with a post-check.
 *  • Replication (§9): on replicas, measures replication lag locally (database credentials never
 *    leave the server) and reports it with the heartbeat.
 *
 * Usage: node infra-agent.js --endpoint https://panel.example.com --token-file /etc/infra-agent/token [--interval 5] [--silent]
 * Requires Node.js 12+. Only outbound HTTP(S) to the panel is needed.
 */
'use strict';

const AGENT_VERSION = '2.6.2';

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

// ── Configuration ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let agentToken = process.env.SMP_TOKEN || '';
let endpoint = 'http://localhost:5000';
let intervalSeconds = 5;
let isSilent = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--token' && args[i + 1]) agentToken = args[++i];
  if (args[i] === '--token-file' && args[i + 1]) agentToken = fs.readFileSync(args[++i], 'utf-8').trim();
  if (args[i] === '--endpoint' && args[i + 1]) endpoint = args[++i];
  if (args[i] === '--interval' && args[i + 1]) intervalSeconds = Math.max(2, parseInt(args[++i], 10) || 5);
  if (args[i] === '--silent') isSilent = true;
}

if (!agentToken) {
  console.error('[infra-agent] Missing agent token: pass --token-file <path>, --token <TOKEN> or SMP_TOKEN');
  process.exit(1);
}
endpoint = endpoint.replace(/\/$/, '');

const IS_LINUX = process.platform === 'linux';
const CAPABILITIES = IS_LINUX ? ['jobs', 'replication'] : [];
const STATE_DIR = '/var/lib/infra-agent';
const REPLICATION_CONF = '/etc/infra-agent/replication.conf';
const SIGNING_KEY = crypto.createHash('sha256').update(agentToken).digest('hex'); // the panel stores this same hash

const log = (...m) => {
  if (!isSilent) console.log(`[${new Date().toISOString()}]`, ...m);
};
const warn = (...m) => console.error(`[${new Date().toISOString()}]`, ...m);

// ── HTTP (works on old Node versions: no global fetch needed) ────────────────
function request(method, urlPath, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint + urlPath);
    const client = url.protocol === 'https:' ? https : http;
    const data = body === undefined ? null : JSON.stringify(body);
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: Object.assign(
          { Authorization: `Bearer ${agentToken}`, 'User-Agent': `infra-agent/${AGENT_VERSION}` },
          data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
        ),
        timeout: timeoutMs || 10000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const postJson = async (urlPath, body) => {
  const res = await request('POST', urlPath, body);
  let json = null;
  try {
    json = JSON.parse(res.body.toString() || 'null');
  } catch (e) {
    json = null;
  }
  return { status: res.status, json };
};

// ── Telemetry ────────────────────────────────────────────────────────────────
let prevCpu = null;
function cpuUsage() {
  const t = os.cpus().reduce(
    (acc, c) => {
      acc.idle += c.times.idle;
      acc.total += c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle;
      return acc;
    },
    { idle: 0, total: 0 }
  );
  const prev = prevCpu;
  prevCpu = t;
  if (!prev || t.total - prev.total <= 0) {
    return Math.min(100, Math.round((os.loadavg()[0] / (os.cpus().length || 1)) * 1000) / 10);
  }
  return Math.max(0, Math.min(100, Math.round((1 - (t.idle - prev.idle) / (t.total - prev.total)) * 1000) / 10));
}

function diskUsage(mount) {
  try {
    const out = execSync(`df -Pk ${mount || '/'} | tail -1`, { encoding: 'utf-8', timeout: 2000 }).trim().split(/\s+/);
    const totalK = parseInt(out[1], 10);
    const usedK = parseInt(out[2], 10);
    return { totalGb: Math.round(totalK / 1048576), usedGb: Math.round(usedK / 1048576), percent: parseFloat(out[4]) };
  } catch (e) {
    return null;
  }
}

function collectTelemetry() {
  const total = os.totalmem();
  const used = total - os.freemem();
  const disk = diskUsage('/');
  return {
    cpuUsage: cpuUsage(),
    memoryUsage: Math.round((used / total) * 1000) / 10,
    memoryTotalMb: Math.round(total / 1048576),
    memoryUsedMb: Math.round(used / 1048576),
    diskUsage: disk ? disk.percent : undefined,
    diskTotalGb: disk ? disk.totalGb : undefined,
    diskUsedGb: disk ? disk.usedGb : undefined,
    loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
    uptimeSeconds: Math.round(os.uptime()),
    hostname: os.hostname(),
    osKernel: `${os.type()} ${os.release()} (${os.arch()})`,
    agentVersion: AGENT_VERSION,
    capabilities: CAPABILITIES,
  };
}

let webDiscoveryCache = null;
let lastWebDiscovery = 0;

function detectWebServerAndSites() {
  if (webDiscoveryCache && Date.now() - lastWebDiscovery < 60000) {
    return webDiscoveryCache;
  }

  let hasNginx = false;
  let hasApache = false;
  let nginxVer = '';
  let apacheVer = '';
  let nginxActive = false;
  let apacheActive = false;

  if (IS_LINUX) {
    try {
      const r = execSync('nginx -v 2>&1', { timeout: 1500, encoding: 'utf-8' });
      nginxVer = (r.match(/nginx version:\s*(.+)/i) || [])[1] || 'nginx';
      hasNginx = true;
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '');
      const m = out.match(/nginx version:\s*(.+)/i);
      if (m) {
        nginxVer = m[1];
        hasNginx = true;
      }
    }

    try {
      const r = execSync('systemctl is-active nginx 2>/dev/null', { timeout: 1500, encoding: 'utf-8' }).trim();
      if (r === 'active') nginxActive = true;
    } catch (e) {}

    try {
      const r = execSync('apache2 -v 2>&1 || httpd -v 2>&1', { timeout: 1500, encoding: 'utf-8' });
      apacheVer = (r.match(/Server version:\s*(.+)/i) || [])[1] || 'apache';
      hasApache = true;
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '');
      const m = out.match(/Server version:\s*(.+)/i);
      if (m) {
        apacheVer = m[1];
        hasApache = true;
      }
    }

    try {
      const r = execSync('systemctl is-active apache2 2>/dev/null || systemctl is-active httpd 2>/dev/null', { timeout: 1500, encoding: 'utf-8' }).trim();
      if (r === 'active') apacheActive = true;
    } catch (e) {}
  }

  let type = 'None';
  let version = 'Not installed';
  let status = 'inactive';
  let configPath = '';

  if (nginxActive && apacheActive) {
    type = 'Nginx + Apache (Reverse Proxy)';
    version = `${nginxVer || 'nginx'} + ${apacheVer || 'apache'}`;
    status = 'active (running)';
    configPath = '/etc/nginx/nginx.conf & /etc/apache2/apache2.conf';
  } else if (nginxActive || (hasNginx && !hasApache)) {
    type = 'Nginx';
    version = nginxVer || 'nginx/1.24.0';
    status = nginxActive ? 'active (running)' : 'installed (stopped)';
    configPath = '/etc/nginx/nginx.conf';
  } else if (apacheActive || (hasApache && !hasNginx)) {
    type = 'Apache';
    version = apacheVer || 'Apache/2.4';
    status = apacheActive ? 'active (running)' : 'installed (stopped)';
    configPath = '/etc/apache2/apache2.conf';
  }

  const sites = [];
  const addSite = (domain, engine, port, ssl, rootPath, proxyPass) => {
    if (!domain || domain === '_' || domain === 'localhost' || domain === 'default') return;
    if (sites.some((s) => s.domain === domain)) return;
    sites.push({
      domain,
      serverEngine: engine,
      port: port || (ssl ? 443 : 80),
      ssl: !!ssl,
      sslProvider: ssl ? "Let's Encrypt" : 'None',
      rootPath: rootPath || '/var/www/html',
      proxyPass: proxyPass || undefined,
      status: 'Active',
      httpStatus: 200,
    });
  };

  if (IS_LINUX) {
    // Check Nginx sites
    for (const dir of ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d']) {
      try {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            try {
              const content = fs.readFileSync(path.join(dir, f), 'utf-8');
              const serverNameMatch = content.match(/server_name\s+([^;]+);/);
              const sslMatch = content.includes('ssl_certificate') || content.includes('listen 443') || content.includes('ssl;');
              const proxyMatch = content.match(/proxy_pass\s+([^;]+);/);
              const rootMatch = content.match(/root\s+([^;]+);/);
              if (serverNameMatch) {
                const domains = serverNameMatch[1].trim().split(/\s+/);
                for (const d of domains) {
                  addSite(d, 'Nginx', sslMatch ? 443 : 80, sslMatch, rootMatch?.[1]?.trim(), proxyMatch?.[1]?.trim());
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }

    // Check Apache sites
    for (const dir of ['/etc/apache2/sites-enabled', '/etc/httpd/conf.d']) {
      try {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            try {
              const content = fs.readFileSync(path.join(dir, f), 'utf-8');
              const serverNameMatch = content.match(/ServerName\s+([^\r\n]+)/i);
              const sslMatch = content.includes('SSLEngine on') || content.includes(':443');
              const rootMatch = content.match(/DocumentRoot\s+([^\r\n]+)/i);
              if (serverNameMatch) {
                addSite(serverNameMatch[1].trim(), 'Apache', sslMatch ? 443 : 80, sslMatch, rootMatch?.[1]?.trim());
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  }

  webDiscoveryCache = {
    webServer: {
      type,
      version,
      status,
      mainPort: 80,
      sslPort: 443,
      configPath,
    },
    websites: sites,
  };
  lastWebDiscovery = Date.now();
  return webDiscoveryCache;
}

// ── Process helper (bounded time, captured output) ───────────────────────────
function run(command, argv, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const child = spawn(command, argv, { env: Object.assign({}, process.env, opts.env || {}, { LC_ALL: 'C' }) });
    const onData = (d) => {
      const s = d.toString();
      out += s;
      if (opts.onOutput) opts.onOutput(s);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      onData(`\n[agent] time limit of ${opts.timeoutSec}s reached — stopping\n`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, (opts.timeoutSec || 60) * 1000);
    const done = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code === null ? 124 : code, out });
    };
    child.on('error', (e) => {
      onData(`[agent] could not start ${command}: ${e.message}\n`);
      done(127);
    });
    child.on('close', done);
  });
}

const bash = (script, opts) => run('bash', ['-c', script], opts);

// ── Replication (§9) ─────────────────────────────────────────────────────────
function readReplicationConf() {
  const conf = {};
  try {
    for (const line of fs.readFileSync(REPLICATION_CONF, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let value = m[2];
      // Shell-style quoting: "…" may contain \" \\ \$ \` escapes; '…' is taken literally
      if (/^".*"$/.test(value)) value = value.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
      else if (/^'.*'$/.test(value)) value = value.slice(1, -1);
      conf[m[1]] = value;
    }
  } catch (e) {
    // no config: defaults below
  }
  return conf;
}

const PG_LAG_SQL =
  "SELECT CASE WHEN NOT pg_is_in_recovery() THEN -1 " +
  'WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0 ' +
  'ELSE COALESCE(EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()), 0) END';

async function measureLag(kind) {
  const conf = readReplicationConf();
  if (kind === 'postgres') {
    const cmd = conf.PG_LAG_CMD || `runuser -u postgres -- psql -XAtqc "${PG_LAG_SQL}"`;
    const r = await bash(cmd, { timeoutSec: 15 });
    const lag = parseFloat(r.out.trim().split('\n').pop());
    if (r.code !== 0 || Number.isNaN(lag)) return { ok: false, error: `lag query failed: ${r.out.trim().slice(0, 200)}` };
    if (lag < 0) return { ok: false, error: 'PostgreSQL is not in recovery mode (this server is not acting as a replica)' };
    return { ok: true, lagSeconds: lag };
  }
  if (kind === 'mysql') {
    const cmd = conf.MYSQL_LAG_CMD || 'mysql -NBe "SHOW REPLICA STATUS\\G" 2>/dev/null || mysql -NBe "SHOW SLAVE STATUS\\G"';
    const r = await bash(cmd, { timeoutSec: 15 });
    const m = r.out.match(/Seconds_Behind_(?:Source|Master):\s*(\S+)/);
    if (!m) return { ok: false, error: `replica status unavailable: ${r.out.trim().slice(0, 200) || 'empty'}` };
    if (m[1] === 'NULL') return { ok: false, error: 'replication threads are not running' };
    return { ok: true, lagSeconds: parseFloat(m[1]) };
  }
  return { ok: false, error: `unsupported replication kind ${kind}` };
}

let replicationChecks = [];
let replicationResults = [];
let lastReplicationRun = 0;

async function runReplicationChecks() {
  if (!replicationChecks.length || Date.now() - lastReplicationRun < 30000) return;
  lastReplicationRun = Date.now();
  const results = [];
  for (const c of replicationChecks) {
    const r = await measureLag(c.kind).catch((e) => ({ ok: false, error: e.message }));
    results.push(Object.assign({ id: c.id }, r));
  }
  replicationResults = results;
}

// A sync / recovery runs the server owner's own script — the panel cannot supply its content
function trustedScript(file) {
  if (!file) return { error: 'not configured' };
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return { error: `${file} is not a file` };
    if (st.uid !== 0) return { error: `${file} must be owned by root` };
    if (st.mode & 0o022) return { error: `${file} must not be writable by group or others` };
    return { file };
  } catch (e) {
    return { error: `${file} not found` };
  }
}

// ── Built-in job scripts (§8 catalog) ────────────────────────────────────────
const SERVICE_NAME = /^[a-zA-Z0-9@._-]{1,64}$/;

const JOBS = {
  'health-check': async (job, out) => {
    const disk = diskUsage('/') || {};
    const inode = await bash("df -Pi / | tail -1 | awk '{print $5}' | tr -d %", { timeoutSec: 10 });
    const failed = await bash('systemctl --failed --no-legend --plain 2>/dev/null | awk \'{print $1}\'', { timeoutSec: 10 });
    const t = collectTelemetry();
    const failedUnits = failed.out.split('\n').map((s) => s.trim()).filter(Boolean);
    const result = {
      cpuUsage: t.cpuUsage,
      memoryUsage: t.memoryUsage,
      diskUsage: disk.percent,
      inodeUsage: parseFloat(inode.out) || null,
      loadAvg: t.loadAvg,
      uptimeHours: Math.round(t.uptimeSeconds / 360) / 10,
      failedServices: failedUnits,
    };
    out(
      `CPU ${result.cpuUsage}% · memory ${result.memoryUsage}% · disk ${result.diskUsage}% · inodes ${result.inodeUsage}%\n` +
        `load ${result.loadAvg.join(' / ')} · up ${result.uptimeHours} h\n` +
        `failed services: ${failedUnits.length ? failedUnits.join(', ') : 'none'}\n`
    );
    const problems = [];
    if (failedUnits.length) problems.push(`${failedUnits.length} failed service(s): ${failedUnits.slice(0, 5).join(', ')}`);
    if (result.diskUsage >= 90) problems.push(`disk ${result.diskUsage}%`);
    if (result.inodeUsage >= 90) problems.push(`inodes ${result.inodeUsage}%`);
    result.issues = problems;
    // The check itself succeeded; what it found is reported, not treated as a failed operation
    return { exitCode: 0, result, postCheck: { ok: true, detail: problems.length ? `Issues found: ${problems.join('; ')}` : 'All checks passed' } };
  },

  'service-restart': async (job, out) => {
    const service = String(job.params.service || '');
    if (!SERVICE_NAME.test(service)) return { exitCode: 2, postCheck: { ok: false, detail: 'Invalid service name' } };
    const env = { SERVICE: service };
    const exists = await bash('systemctl cat -- "$SERVICE" >/dev/null 2>&1', { env, timeoutSec: 10 });
    if (exists.code !== 0) return { exitCode: 3, postCheck: { ok: false, detail: `Service ${service} does not exist on this server` } };
    out(`Restarting ${service}…\n`);
    const r = await bash('systemctl restart -- "$SERVICE" && sleep 3 && systemctl status --no-pager --lines=5 -- "$SERVICE"', {
      env,
      timeoutSec: job.timeoutSec,
      onOutput: out,
    });
    const active = (await bash('systemctl is-active -- "$SERVICE"', { env, timeoutSec: 10 })).out.trim();
    return {
      exitCode: r.code,
      result: { service, state: active },
      postCheck: { ok: active === 'active', detail: `${service} is ${active}` },
    };
  },

  cleanup: async (job, out) => {
    const dry = job.params.dryRun !== false;
    const before = diskUsage('/') || {};
    const script = dry
      ? [
          'echo "DRY RUN — nothing will be deleted"',
          'journalctl --disk-usage 2>/dev/null || true',
          'echo "Package cache:"; du -sh /var/cache/apt/archives /var/cache/dnf /var/cache/yum 2>/dev/null || true',
          'echo "Temp files older than 7 days:"; find /tmp /var/tmp -xdev -type f -mtime +7 2>/dev/null | wc -l',
        ].join('\n')
      : [
          'journalctl --vacuum-time=7d 2>&1 || true',
          'if command -v apt-get >/dev/null; then apt-get clean; elif command -v dnf >/dev/null; then dnf clean all; elif command -v yum >/dev/null; then yum clean all; fi',
          'echo "Removing temp files older than 7 days:"; find /tmp /var/tmp -xdev -type f -mtime +7 -print -delete 2>/dev/null | wc -l',
        ].join('\n');
    const r = await bash(script, { timeoutSec: job.timeoutSec, onOutput: out });
    const after = diskUsage('/') || {};
    const freedGb = Math.max(0, (before.usedGb || 0) - (after.usedGb || 0));
    return {
      exitCode: r.code,
      result: { dryRun: dry, diskBefore: before.percent, diskAfter: after.percent, freedGb },
      postCheck: { ok: r.code === 0, detail: dry ? 'Dry run only — nothing deleted' : `Disk ${before.percent}% → ${after.percent}%` },
    };
  },

  'agent-update': async (job, out) => {
    const res = await request('GET', '/api/agent/script', undefined, 30000);
    if (res.status !== 200) return { exitCode: 4, postCheck: { ok: false, detail: `Download failed (HTTP ${res.status})` } };
    const sha = crypto.createHash('sha256').update(res.body).digest('hex');
    if (sha !== job.params.sha256) return { exitCode: 5, postCheck: { ok: false, detail: 'Checksum mismatch — update refused' } };
    const target = path.resolve(__filename);
    fs.writeFileSync(`${target}.new`, res.body, { mode: 0o755 });
    fs.renameSync(`${target}.new`, target);
    out(`Installed agent ${job.params.version} (sha256 ${sha.slice(0, 12)}…). Restarting.\n`);
    restartAfterReport = true; // systemd (Restart=always) starts the new version
    return { exitCode: 0, result: { version: job.params.version }, postCheck: { ok: true, detail: 'Installed; waiting for the new version to report' } };
  },

  reboot: async (job, out) => {
    out('Immediate reboot instruction received from control plane. Initiating system power cycle...\n');
    setTimeout(() => {
      try {
        spawn('reboot', [], { detached: true, stdio: 'ignore' }).unref();
      } catch (e) {}
      try {
        spawn('shutdown', ['-r', 'now'], { detached: true, stdio: 'ignore' }).unref();
      } catch (e) {}
    }, 1200);
    return { exitCode: 0, postCheck: { ok: true, detail: 'Reboot dispatched immediately; host operating system restarting' } };
  },

  'replica-sync': (job, out) => replicaJob('SYNC_SCRIPT', job, out),
  'replica-recovery': (job, out) => replicaJob('RECOVERY_SCRIPT', job, out),
};

async function replicaJob(confKey, job, out) {
  const conf = readReplicationConf();
  const t = trustedScript(conf[confKey]);
  if (t.error) {
    return {
      exitCode: 6,
      postCheck: { ok: false, detail: `${confKey} in ${REPLICATION_CONF}: ${t.error}. The server owner must install the approved script first.` },
    };
  }
  out(`Running ${t.file} (primary ${job.params.primaryName} at ${job.params.primaryHost})\n`);
  const r = await run(t.file, [], {
    env: { PRIMARY_HOST: String(job.params.primaryHost || ''), REPLICATION_KIND: String(job.params.kind || ''), RELATIONSHIP_ID: String(job.params.relationshipId || '') },
    timeoutSec: job.timeoutSec,
    onOutput: out,
  });
  if (r.code !== 0) return { exitCode: r.code, postCheck: { ok: false, detail: `Script exited with ${r.code}` } };
  // Post-check (§9 "verify after completion"): replication must be caught up again
  const lag = await measureLag(job.params.kind);
  const ok = lag.ok && lag.lagSeconds <= (job.params.lagWarnSeconds || 60);
  return {
    exitCode: 0,
    result: { lagSeconds: lag.ok ? lag.lagSeconds : null },
    postCheck: { ok, detail: lag.ok ? `Replica lag after sync: ${Math.round(lag.lagSeconds)} s` : lag.error },
  };
}

// ── Job runner ───────────────────────────────────────────────────────────────
let busy = false;
let restartAfterReport = false;
const seen = new Set();

function loadSeen() {
  try {
    JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'jobs.json'), 'utf-8')).forEach((id) => seen.add(id));
  } catch (e) {
    // first run
  }
}
function saveSeen() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(path.join(STATE_DIR, 'jobs.json'), JSON.stringify([...seen].slice(-200)));
  } catch (e) {
    // not fatal (e.g. running without root during development)
  }
}

const validSignature = (job) => {
  const expected = crypto.createHmac('sha256', SIGNING_KEY).update(`${job.id}|${job.key}|${JSON.stringify(job.params)}`).digest('hex');
  return typeof job.signature === 'string' && job.signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(job.signature), Buffer.from(expected));
};

async function runJob(job) {
  seen.add(job.id);
  saveSeen();
  log(`job ${job.id}: ${job.key}`);

  let pending = '';
  const out = (s) => {
    pending += s;
  };
  const flush = async () => {
    const chunk = pending;
    pending = '';
    await postJson(`/api/agent/jobs/${job.id}/progress`, { output: chunk }).catch(() => {
      pending = chunk + pending; // retry with the next flush
    });
  };
  await flush(); // marks the job Running
  const ticker = setInterval(() => flush().catch(() => {}), 2000);

  let outcome;
  try {
    const handler = JOBS[job.key];
    outcome = handler ? await handler(job, out) : { exitCode: 127, postCheck: { ok: false, detail: `Unknown job ${job.key}` } };
  } catch (e) {
    outcome = { exitCode: 1, postCheck: { ok: false, detail: e.message } };
  }
  clearInterval(ticker);

  const report = Object.assign({ output: pending }, outcome);
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await postJson(`/api/agent/jobs/${job.id}/result`, report).catch(() => null);
    if (r && r.status < 500) break;
    await new Promise((res) => setTimeout(res, 3000));
  }
  log(`job ${job.id}: exit ${outcome.exitCode}`);

  if (restartAfterReport) {
    log('restarting to load the updated agent');
    setTimeout(() => process.exit(0), 500);
  }
}

async function handleJobs(jobs) {
  if (busy || !Array.isArray(jobs)) return;
  for (const job of jobs) {
    if (!job || !job.id || seen.has(job.id)) continue;
    if (!validSignature(job)) {
      warn(`rejected job ${job.id}: bad signature`);
      seen.add(job.id);
      continue;
    }
    if (!IS_LINUX) {
      await postJson(`/api/agent/jobs/${job.id}/result`, { exitCode: 126, output: '', postCheck: { ok: false, detail: 'Operations need a Linux agent' } }).catch(() => {});
      continue;
    }
    busy = true;
    try {
      await runJob(job);
    } finally {
      busy = false;
    }
  }
}

// ── Heartbeat loop ───────────────────────────────────────────────────────────
let connected = false;

async function heartbeat() {
  const payload = collectTelemetry();
  const webInfo = detectWebServerAndSites();
  if (webInfo?.webServer) payload.webServer = webInfo.webServer;
  if (webInfo?.websites?.length) payload.websites = webInfo.websites;
  if (replicationResults.length) payload.replication = replicationResults;
  try {
    const r = await postJson('/api/agent/heartbeat', payload);
    if (r.status !== 200) {
      warn(`heartbeat rejected: HTTP ${r.status} ${r.json && r.json.error ? r.json.error : ''}`);
      return;
    }
    if (!connected) {
      connected = true;
      log(`connected to ${endpoint} (agent ${AGENT_VERSION})`);
    }
    replicationChecks = (r.json && r.json.replicationChecks) || [];
    runReplicationChecks().catch((e) => warn('replication check failed:', e.message));
    if (r.json && r.json.jobs && r.json.jobs.length) handleJobs(r.json.jobs).catch((e) => warn('job failed:', e.message));
  } catch (e) {
    if (connected) warn(`cannot reach ${endpoint}: ${e.message}`);
    connected = false;
  }
}

loadSeen();
log(`infra-agent ${AGENT_VERSION} starting — panel ${endpoint}, every ${intervalSeconds}s`);
heartbeat();
setInterval(heartbeat, intervalSeconds * 1000);
