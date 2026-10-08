import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Settings,
  Zap,
  Play,
  Copy,
  Check,
  Power,
  X,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const WebTerminalConsole = ({ server, height = '500px' }) => {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);

  const { token } = useAuth();
  const { success, error: showError } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Connection settings
  const [customHost, setCustomHost] = useState(server?.network?.publicIp || server?.hostname || '127.0.0.1');
  const [customPort, setCustomPort] = useState('22');
  const [customUsername, setCustomUsername] = useState('root');
  const [customPassword, setCustomPassword] = useState('');
  const [connectionMode, setConnectionMode] = useState('auto'); // 'auto' | 'ssh' | 'emulated'

  const quickCommands = [
    { label: 'htop (Resource Monitor)', cmd: 'htop' },
    { label: 'docker ps', cmd: 'docker ps' },
    { label: 'df -h (Disk Usage)', cmd: 'df -h' },
    { label: 'free -m (RAM)', cmd: 'free -m' },
    { label: 'ls -la', cmd: 'ls -la' },
    { label: 'systemctl status nginx', cmd: 'systemctl status nginx' },
    { label: 'uptime', cmd: 'uptime' },
  ];

  const connectTerminal = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    setIsConnecting(true);
    setIsConnected(false);

    // Initialize xterm if not yet initialized
    if (!xtermInstance.current && terminalRef.current) {
      const term = new Terminal({
        theme: {
          background: '#0c0e14',
          foreground: '#e2e8f0',
          cursor: '#38bdf8',
          selectionBackground: '#1e293b',
          black: '#1e293b',
          red: '#f43f5e',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#d946ef',
          cyan: '#06b6d4',
          white: '#f8fafc',
        },
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.25,
        cursorBlink: true,
        scrollback: 1000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermInstance.current = term;
      fitAddonRef.current = fitAddon;
    } else if (xtermInstance.current) {
      xtermInstance.current.reset();
      fitAddonRef.current?.fit();
    }

    const term = xtermInstance.current;
    term.write('\x1b[36mInitializing WebSocket SSH bridge...\x1b[0m\r\n');

    // Build ws connection URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Same origin as the app (Vite proxies /ws in dev)
    const wsUrl = new URL(`${protocol}//${window.location.host}/ws/terminal`);

    if (token) wsUrl.searchParams.set('token', token);
    if (server?._id) wsUrl.searchParams.set('serverId', server._id);
    if (customHost) wsUrl.searchParams.set('host', customHost);
    if (customPort) wsUrl.searchParams.set('port', customPort);
    if (customUsername) wsUrl.searchParams.set('username', customUsername);
    if (customPassword) wsUrl.searchParams.set('password', customPassword);
    if (connectionMode === 'emulated') wsUrl.searchParams.set('emulate', 'true');

    const ws = new WebSocket(wsUrl.toString());
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      // Send initial dimensions
      if (term) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onmessage = (event) => {
      if (term) {
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      if (term) {
        term.write('\r\n\x1b[31m[WebSocket Connection Closed]\x1b[0m\r\n');
      }
    };

    ws.onerror = (err) => {
      setIsConnected(false);
      setIsConnecting(false);
      if (term) {
        term.write('\r\n\x1b[31m[WebSocket Connection Error]\x1b[0m\r\n');
      }
    };

    // Forward keystrokes to websocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  };

  useEffect(() => {
    connectTerminal();

    const handleResize = () => {
      if (fitAddonRef.current && xtermInstance.current && socketRef.current?.readyState === WebSocket.OPEN) {
        fitAddonRef.current.fit();
        socketRef.current.send(
          JSON.stringify({
            type: 'resize',
            cols: xtermInstance.current.cols,
            rows: xtermInstance.current.rows,
          })
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose();
        xtermInstance.current = null;
      }
    };
  }, [server?._id]);

  const sendCommand = (cmd) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(cmd + '\r');
    } else {
      showError('Terminal is not connected. Reconnect first.');
    }
  };

  const copySSHCommand = () => {
    const ip = server?.network?.publicIp || customHost || '127.0.0.1';
    const user = customUsername || 'root';
    const cmd = `ssh ${user}@${ip} -p ${customPort || 22}`;
    navigator.clipboard.writeText(cmd);
    setIsCopied(true);
    success('Copied SSH command');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`flex flex-col bg-[#080a0f] border border-[#1e2433] rounded-xl overflow-hidden transition-all duration-200 shadow-2xl ${
        isFullScreen ? 'fixed inset-4 z-50 rounded-2xl' : 'w-full'
      }`}
      style={{ height: isFullScreen ? 'calc(100vh - 32px)' : height }}
    >
      {/* 1. Terminal Window Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0f121a] border-b border-[#1e2433] select-none">
        {/* Left: Window Controls & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600"></div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">
              {customUsername}@{server?.name || customHost}
            </span>
            <span className="text-slate-500">({customHost}:{customPort})</span>
          </div>

          {/* Status Badge */}
          <div>
            {isConnecting ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-400 border border-blue-600/40 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                CONNECTING...
              </span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#0e291e] text-[#22c55e] border border-[#166534]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping inline-block"></span>
                SSH ONLINE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-400 border border-rose-600/40">
                DISCONNECTED
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick preset for Local WSL / Ubuntu */}
          <button
            onClick={() => {
              setCustomHost('127.0.0.1');
              setCustomPort('22');
              setCustomUsername('ubuntu');
              setConnectionMode('auto');
              setShowConfig(true);
            }}
            title="Preset: Connect to Local WSL / Ubuntu (127.0.0.1)"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#1e2436] text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
          >
            <Laptop className="w-3 h-3 text-cyan-400" />
            <span>Local WSL Preset</span>
          </button>

          {/* Copy CLI SSH Command */}
          <button
            onClick={copySSHCommand}
            title="Copy native SSH command"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#1e2436] text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            <span className="hidden md:inline">Copy SSH</span>
          </button>

          {/* Connection Settings Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            title="Connection & Credential Settings"
            className={`p-1.5 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#1e2436] text-slate-300 transition-colors cursor-pointer ${
              showConfig ? 'border-blue-500 text-blue-400' : ''
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Reconnect */}
          <button
            onClick={connectTerminal}
            title="Reconnect Terminal Session"
            className="p-1.5 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#1e2436] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => {
              setIsFullScreen(!isFullScreen);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#1e2436] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Connection Config Drawer (If Open) */}
      {showConfig && (
        <div className="bg-[#111522] border-b border-[#21283c] p-3 text-xs font-mono text-slate-300 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[10px] uppercase text-slate-400 mb-1">Host / IP</label>
            <input
              type="text"
              value={customHost}
              onChange={(e) => setCustomHost(e.target.value)}
              placeholder="127.0.0.1 or IP"
              className="w-full bg-[#090b10] border border-[#2a334a] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-slate-400 mb-1">Port</label>
            <input
              type="text"
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              placeholder="22"
              className="w-full bg-[#090b10] border border-[#2a334a] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-slate-400 mb-1">User</label>
            <input
              type="text"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
              placeholder="root or ubuntu"
              className="w-full bg-[#090b10] border border-[#2a334a] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-slate-400 mb-1">SSH Password</label>
            <input
              type="password"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Optional password"
              className="w-full bg-[#090b10] border border-[#2a334a] rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowConfig(false);
                connectTerminal();
              }}
              className="flex-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Connect
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-2 py-1.5 rounded bg-[#1b2030] text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Terminal Canvas Body */}
      <div className="flex-1 bg-[#0c0e14] p-3 overflow-hidden" onClick={() => xtermInstance.current?.focus()}>
        <div ref={terminalRef} className="h-full w-full" />
      </div>

      {/* 4. Quick Command Bar */}
      <div className="bg-[#0f121a] border-t border-[#1e2433] px-3 py-2 flex items-center gap-2 overflow-x-auto select-none">
        <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 flex items-center gap-1 shrink-0">
          <Zap className="w-3 h-3 text-amber-400" />
          Quick Cmds:
        </span>

        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => sendCommand(qc.cmd)}
            className="shrink-0 px-2 py-0.5 rounded bg-[#161a26] border border-[#262f44] hover:bg-[#202638] text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
          >
            <Play className="w-2.5 h-2.5 text-blue-400" />
            <span>{qc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
