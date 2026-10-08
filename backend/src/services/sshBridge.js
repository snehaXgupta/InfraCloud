const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, ENABLE_WEB_TERMINAL } = require('../config/env');
const Server = require('../models/Server');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');

/**
 * Initialize SSH WebSocket Bridge on the shared HTTP server
 */
function initSSHBridge(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/terminal',
  });

  console.log('[SSH Bridge] WebSocket terminal server initialized on /ws/terminal');

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const serverId = url.searchParams.get('serverId');
      const customHost = url.searchParams.get('host');
      const customPort = parseInt(url.searchParams.get('port') || '22', 10);
      const customUsername = url.searchParams.get('username');
      const customPassword = url.searchParams.get('password');
      const customKey = url.searchParams.get('privateKey');
      const forceEmulate = url.searchParams.get('emulate') === 'true';

      // Interactive shells bypass the operation catalog (discovery doc §8), so the terminal is
      // off unless explicitly enabled, and then restricted to active Platform Admins.
      if (!ENABLE_WEB_TERMINAL) {
        ws.send('\r\n\x1b[33m[Terminal Disabled] The web terminal is disabled on this control plane. Use approved operations instead.\x1b[0m\r\n');
        return ws.close(4003, 'Terminal disabled');
      }

      // 1. Verify JWT Authentication
      let user = null;
      try {
        const decoded = jwt.verify(token || '', JWT_SECRET);
        user = await User.findById(decoded.id).select('name email role status');
      } catch (err) {
        user = null;
      }
      if (!user || user.status !== 'active' || user.role !== 'Platform Admin') {
        ws.send('\r\n\x1b[31m[Authorization Error] Web terminal requires an active Platform Admin session.\x1b[0m\r\n');
        return ws.close(4001, 'Unauthorized');
      }

      // 2. Fetch target server record if serverId is provided
      let serverNode = null;
      if (serverId) {
        try {
          serverNode = await Server.findById(serverId);
        } catch (err) {
          // Soft ignore
        }
      }

      const host = customHost || serverNode?.network?.publicIp || serverNode?.hostname || '127.0.0.1';
      const port = customPort || 22;
      const username = customUsername || 'root';
      const password = customPassword || serverNode?.accessCredentials?.sshPassword || null;
      const privateKey = customKey || serverNode?.accessCredentials?.sshPrivateKey || null;

      ws.send(`\x1b[36mConnecting to ${username}@${host}:${port}...\x1b[0m\r\n`);

      // 3. If emulation forced or no credentials on dummy IP, run interactive Linux shell emulator
      if (forceEmulate || (host.startsWith('142.93.') && !password && !privateKey)) {
        startEmulatedShell(ws, { host, username, serverNode, user });
        return;
      }

      // 4. Connect via Real SSH (ssh2)
      const sshClient = new Client();
      let stream = null;

      sshClient.on('ready', () => {
        ws.send(`\x1b[32m[SSH Connected] Established secure session with ${host}\x1b[0m\r\n\r\n`);

        if (user && serverNode) {
          logAudit({
            userId: user.id || user._id,
            action: 'SSH_TERMINAL_SESSION_OPENED',
            targetType: 'Server',
            targetId: serverNode._id,
            metadata: { host, username, port },
            ipAddress: req.socket.remoteAddress,
          });
        }

        sshClient.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, sshStream) => {
          if (err) {
            ws.send(`\r\n\x1b[31m[Shell Error] ${err.message}\x1b[0m\r\n`);
            return ws.close();
          }

          stream = sshStream;

          sshStream.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(data.toString('utf-8'));
            }
          });

          sshStream.on('close', () => {
            ws.send('\r\n\x1b[33m[SSH Connection Closed by Remote Host]\x1b[0m\r\n');
            ws.close();
            sshClient.end();
          });
        });
      });

      sshClient.on('error', (err) => {
        ws.send(`\r\n\x1b[31m[SSH Connection Failed] ${err.message}\x1b[0m\r\n`);
        ws.send(`\x1b[90mTip: Falling back to Interactive Emulation Mode for testing...\x1b[0m\r\n\r\n`);
        startEmulatedShell(ws, { host, username, serverNode, user });
      });

      // Handle messages from browser xterm.js
      ws.on('message', (msg) => {
        try {
          const str = msg.toString();
          // Check if message is a JSON control event (e.g. resize)
          if (str.startsWith('{') && str.endsWith('}')) {
            const parsed = JSON.parse(str);
            if (parsed.type === 'resize' && stream) {
              stream.setWindow(parsed.rows || 24, parsed.cols || 80, 0, 0);
              return;
            }
          }
          if (stream) {
            stream.write(str);
          }
        } catch (e) {
          if (stream) stream.write(msg);
        }
      });

      ws.on('close', () => {
        if (sshClient) sshClient.end();
      });

      const connectConfig = {
        host,
        port,
        username,
        readyTimeout: 7000,
      };

      if (privateKey) {
        connectConfig.privateKey = privateKey;
      } else if (password) {
        connectConfig.password = password;
      } else {
        ws.send('\x1b[31m[SSH] No credentials configured for this server.\x1b[0m\r\n');
        return ws.close(4002, 'No credentials');
      }

      sshClient.connect(connectConfig);
    } catch (err) {
      console.error('[SSH Bridge Error]', err);
      ws.send(`\r\n\x1b[31mInternal Bridge Error: ${err.message}\x1b[0m\r\n`);
      ws.close();
    }
  });
}

/**
 * Interactive Linux Shell Emulator for sandbox environments / demo instances
 */
function startEmulatedShell(ws, { host, username, serverNode }) {
  const hostname = serverNode?.hostname || host || 'ubuntu-prod-node';
  const serverName = serverNode?.name || 'Droplet Instance';
  let currentDir = '~';
  let commandBuffer = '';

  const prompt = () => {
    ws.send(`\r\n\x1b[1;32m${username}@${hostname}\x1b[0m:\x1b[1;34m${currentDir}\x1b[0m# `);
  };

  // Welcome MOTD banner
  ws.send(`\r\n\x1b[1;36mWelcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-generic x86_64)\x1b[0m\r\n`);
  ws.send(` * Documentation:  https://help.ubuntu.com\r\n`);
  ws.send(` * Management:     SPACES PANEL Infrastructure Control Plane v1.0\r\n`);
  ws.send(` * System Node:    ${serverName} (${host})\r\n`);
  ws.send(`\x1b[33m[Interactive Web Terminal Connected — Type 'help', 'htop', 'ls', 'docker ps', 'df -h']\x1b[0m\r\n`);
  prompt();

  ws.on('message', (data) => {
    const str = data.toString();

    // Check resize packet
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === 'resize') return;
      } catch (e) {}
    }

    // Handle Enter
    if (str === '\r' || str === '\n') {
      const cmd = commandBuffer.trim();
      commandBuffer = '';
      ws.send('\r\n');
      executeEmulatedCommand(cmd, ws, { hostname, serverNode, currentDir });
      prompt();
      return;
    }

    // Handle Backspace
    if (str === '\x7f' || str === '\b') {
      if (commandBuffer.length > 0) {
        commandBuffer = commandBuffer.slice(0, -1);
        ws.send('\b \b');
      }
      return;
    }

    // Handle Ctrl+C
    if (str === '\x03') {
      commandBuffer = '';
      ws.send('^C\r\n');
      prompt();
      return;
    }

    // Handle Clear (Ctrl+L)
    if (str === '\x0c') {
      ws.send('\x1b[2J\x1b[H');
      prompt();
      return;
    }

    // Echo character to terminal
    commandBuffer += str;
    ws.send(str);
  });
}

function executeEmulatedCommand(cmd, ws, { hostname, serverNode, currentDir }) {
  if (!cmd) return;

  const parts = cmd.split(' ');
  const base = parts[0].toLowerCase();

  switch (base) {
    case 'help':
      ws.send(`\x1b[1;37mSupported Commands in Terminal:\x1b[0m\r\n`);
      ws.send(`  \x1b[32mls, dir\x1b[0m         List files in current directory\r\n`);
      ws.send(`  \x1b[32mhtop, top\x1b[0m       Display system real-time resource monitor\r\n`);
      ws.send(`  \x1b[32mps, ps aux\x1b[0m      List running kernel daemon processes\r\n`);
      ws.send(`  \x1b[32mdocker ps\x1b[0m       Show running Docker containers\r\n`);
      ws.send(`  \x1b[32mdf, df -h\x1b[0m       Show disk filesystem usage\r\n`);
      ws.send(`  \x1b[32mfree, free -m\x1b[0m   Show RAM & Swap memory allocation\r\n`);
      ws.send(`  \x1b[32muptime\x1b[0m          Show system uptime and load averages\r\n`);
      ws.send(`  \x1b[32muname -a\x1b[0m        Show Linux kernel specifications\r\n`);
      ws.send(`  \x1b[32msystemctl status\x1b[0m Check status of system services (nginx, docker, postgres)\r\n`);
      ws.send(`  \x1b[32mclear\x1b[0m           Clear the terminal console\r\n`);
      break;

    case 'clear':
      ws.send('\x1b[2J\x1b[H');
      break;

    case 'uname':
      ws.send(`Linux ${hostname} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\n`);
      break;

    case 'uptime':
      const uptimeDays = Math.floor(Math.random() * 10) + 12;
      ws.send(` 17:15:20 up ${uptimeDays} days, 4:12,  2 users,  load average: 0.18, 0.22, 0.19\r\n`);
      break;

    case 'free':
    case 'free -m':
    case 'free -h':
      const ram = serverNode?.compute?.ramGb || 8;
      const ramMb = ram * 1024;
      const usedMb = Math.round(ramMb * 0.42);
      const freeMb = ramMb - usedMb - 850;
      ws.send(`               total        used        free      shared  buff/cache   available\r\n`);
      ws.send(`Mem:         ${ramMb}M       ${usedMb}M       ${freeMb}M        128M        850M       ${ramMb - usedMb}M\r\n`);
      ws.send(`Swap:         2048M          0M       2048M\r\n`);
      break;

    case 'df':
    case 'df -h':
      const disk = serverNode?.storage?.diskTotalGb || 80;
      const usedDisk = Math.round(disk * 0.58);
      ws.send(`Filesystem      Size  Used Avail Use% Mounted on\r\n`);
      ws.send(`/dev/root        ${disk}G   ${usedDisk}G   ${disk - usedDisk}G  58% /\r\n`);
      ws.send(`tmpfs           3.9G     0  3.9G   0% /dev/shm\r\n`);
      ws.send(`/dev/sda15      105M  6.1M   99M   6% /boot/efi\r\n`);
      break;

    case 'ls':
    case 'dir':
      ws.send(`\x1b[1;34mapp\x1b[0m   \x1b[1;34mbackups\x1b[0m   docker-compose.yml   \x1b[1;32minfra-agent.sh\x1b[0m   \x1b[1;34mlogs\x1b[0m   nginx.conf   README.md\r\n`);
      break;

    case 'docker':
      if (parts[1] === 'ps' || parts[1] === 'ps -a') {
        ws.send(`CONTAINER ID   IMAGE                 COMMAND                  CREATED        STATUS        PORTS                    NAMES\r\n`);
        ws.send(`\x1b[33m8f3a92b10c\x1b[0m    nginx:alpine          "/docker-entrypoint.…"   5 days ago     Up 5 days     0.0.0.0:80->80/tcp       frontend-proxy\r\n`);
        ws.send(`\x1b[33mc4d189e02f\x1b[0m    postgres:16-alpine    "docker-entrypoint.s…"   12 days ago    Up 12 days    0.0.0.0:5432->5432/tcp   db-primary\r\n`);
        ws.send(`\x1b[33m11e9a44c7b\x1b[0m    redis:7.2-alpine      "docker-entrypoint.s…"   12 days ago    Up 12 days    6379/tcp                 cache-layer\r\n`);
      } else {
        ws.send(`Docker version 27.2.0, build 3ab4256\r\nUse 'docker ps' to see active containers.\r\n`);
      }
      break;

    case 'htop':
    case 'top':
      const vcpu = serverNode?.compute?.vcpu || 4;
      ws.send(`\x1b[1;37m  1  [\x1b[32m||||||||||||\x1b[90m                                        \x1b[37m24.1%]   Tasks: 98 total, 1 running, 97 sleeping\x1b[0m\r\n`);
      ws.send(`\x1b[1;37m  2  [\x1b[32m|||||||||\x1b[90m                                           \x1b[37m18.4%]   Load average: 0.28 0.32 0.21\x1b[0m\r\n`);
      ws.send(`\x1b[1;37m  Mem[\x1b[34m|||||||||||||||||||||||\x1b[90m                             \x1b[37m3.42G/${serverNode?.compute?.ramGb || 8}.00G]\x1b[0m\r\n`);
      ws.send(`\x1b[1;37m  Swp[\x1b[90m                                                    \x1b[37m0K/2.00G]\x1b[0m\r\n\r\n`);
      ws.send(`\x1b[7m  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%   TIME+  Command                     \x1b[0m\r\n`);
      ws.send(` 1042 root       20   0 1420M  380M 42100 S  2.4  4.8  14:22.18 /usr/bin/dockerd             \r\n`);
      ws.send(` 2190 postgres   20   0 2180M  512M 18900 S  1.8  6.4  38:10.45 postgres: primary wal sender \r\n`);
      ws.send(` 3412 root       20   0  180M   48M 12400 S  0.4  0.6   2:45.10 infra-agent --daemon         \r\n`);
      ws.send(`  820 root       20   0   98M   14M  8100 S  0.0  0.2   0:12.80 sshd: root@pts/0             \r\n`);
      break;

    case 'ps':
      ws.send(`  PID TTY          TIME CMD\r\n`);
      ws.send(` 3412 ?        00:02:45 infra-agent\r\n`);
      ws.send(` 8912 pts/0    00:00:00 bash\r\n`);
      ws.send(` 9044 pts/0    00:00:00 ps\r\n`);
      break;

    case 'systemctl':
      if (parts[1] === 'status') {
        const target = parts[2] || 'nginx';
        ws.send(`● \x1b[1;32m${target}.service\x1b[0m - High performance web server and reverse proxy\r\n`);
        ws.send(`     Loaded: loaded (/lib/systemd/system/${target}.service; enabled; vendor preset: enabled)\r\n`);
        ws.send(`     Active: \x1b[1;32mactive (running)\x1b[0m since Fri 2026-09-25 08:30:12 UTC; 5 days ago\r\n`);
        ws.send(`   Main PID: 1042 (${target})\r\n`);
        ws.send(`      Tasks: 4 (limit: 9412)\r\n`);
        ws.send(`     Memory: 42.1M (limit: 2.0G)\r\n`);
      } else {
        ws.send(`Usage: systemctl status <service_name>\r\n`);
      }
      break;

    case 'whoami':
      ws.send(`root\r\n`);
      break;

    case 'pwd':
      ws.send(`/root\r\n`);
      break;

    default:
      ws.send(`bash: ${base}: command not found. Type \x1b[33m'help'\x1b[0m for available commands.\r\n`);
      break;
  }
}

module.exports = { initSSHBridge };
