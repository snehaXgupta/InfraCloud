import React, { useState, useEffect } from 'react';
import { Copy, Check, Cpu, Activity, ShieldCheck, KeyRound, CircleDashed, CircleCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const HEARTBEAT_FRESH_MS = 60 * 1000;

const ChecklistItem = ({ done, label, hint }) => (
  <div className="flex items-start gap-2">
    {done ? (
      <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-px" />
    ) : (
      <CircleDashed className="w-4 h-4 text-slate-500 shrink-0 mt-px animate-spin [animation-duration:3s]" />
    )}
    <div>
      <div className={done ? 'text-emerald-300 font-medium' : 'text-slate-300'}>{label}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  </div>
);

export const InstallAgentModal = ({ isOpen, server, onClose, onRefreshServer }) => {
  const [copiedType, setCopiedType] = useState(null);
  const [activeTab, setActiveTab] = useState('linux'); // 'linux' | 'manual'
  const [liveServerData, setLiveServerData] = useState(server);
  const [metricsSource, setMetricsSource] = useState(null);
  const [token, setToken] = useState(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [panelUrl, setPanelUrl] = useState(window.location.origin);
  const { success, error: showError } = useToast();

  useEffect(() => {
    setLiveServerData(server);
  }, [server]);

  useEffect(() => {
    if (!isOpen) setToken(null);
  }, [isOpen]);

  // Poll heartbeat and metrics status while the modal is open
  useEffect(() => {
    if (!isOpen || !server?._id) return;

    const pollStatus = async () => {
      try {
        const [serverRes, metricsRes] = await Promise.all([
          api.get(`/servers/${server._id}`),
          api.get(`/servers/${server._id}/metrics?timeRange=5m`),
        ]);
        if (serverRes.data?.success) {
          setLiveServerData(serverRes.data.data);
          if (onRefreshServer) onRefreshServer();
        }
        if (metricsRes.data?.success) {
          const m = metricsRes.data.data;
          setMetricsSource(m.source === 'prometheus' && !m.isStale ? 'live' : m.source);
        }
      } catch (err) {
        // Soft ignore; next poll retries
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen, server?._id]);

  if (!isOpen || !server) return null;

  const issueToken = async () => {
    setIsIssuing(true);
    try {
      const res = await api.post(`/servers/${server._id}/agent-token`);
      setToken(res.data.data.token);
      success('Agent token issued. Any previous token for this server is now revoked.');
    } catch (err) {
      showError(err.response?.data?.error || 'Could not issue agent token');
    } finally {
      setIsIssuing(false);
    }
  };

  const baseUrl = panelUrl.replace(/\/$/, '');
  const tokenText = token || '<generate a token first>';
  const linuxCommand = `curl -fsSL ${baseUrl}/api/agent/install.sh | sudo SMP_URL=${baseUrl} SMP_TOKEN=${tokenText} bash`;
  const manualCommand = `curl -fsSL ${baseUrl}/api/agent/script -o infra-agent.js && SMP_TOKEN=${tokenText} node infra-agent.js --endpoint ${baseUrl}`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    success(`Copied ${type} command to clipboard`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const lastHeartbeat = liveServerData?.agent?.lastHeartbeat;
  const heartbeatFresh =
    !!liveServerData?.agent?.isLiveAgent && lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < HEARTBEAT_FRESH_MS;
  const metricsLive = metricsSource === 'live';

  const CommandBox = ({ command, type }) => (
    <div className="relative bg-[#090b10] border border-[#21283c] rounded-lg p-3 font-mono text-xs text-emerald-400 flex items-start justify-between gap-3">
      <span className="break-all">{command}</span>
      <button
        onClick={() => copyToClipboard(command, type)}
        disabled={!token}
        className="p-1.5 rounded bg-[#182030] hover:bg-[#222c42] text-slate-300 hover:text-white shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        title={token ? 'Copy' : 'Generate a token first'}
      >
        {copiedType === type ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect server"
      subtitle={`Install the monitoring agent on '${server.name}'`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5 text-slate-300 text-xs">
        {/* Step 1: token */}
        <div className="space-y-2">
          <div className="font-bold text-white text-sm">1. Generate an agent token</div>
          <p className="text-slate-400">
            The token identifies this server to the panel. It is shown once; generating a new one revokes the old one.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={issueToken} disabled={isIssuing}>
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
              {token ? 'Regenerate token' : isIssuing ? 'Generating…' : 'Generate token'}
            </Button>
            {token && <span className="text-amber-400 text-[11px]">Copy the command now — the token will not be shown again.</span>}
          </div>
        </div>

        {/* Step 2: command */}
        <div className="space-y-2">
          <div className="font-bold text-white text-sm">2. Run on the server</div>
          <label className="block text-[11px] text-slate-400">
            Panel URL as reachable from the server
            <input
              value={panelUrl}
              onChange={(e) => setPanelUrl(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] font-mono text-xs text-slate-200"
            />
          </label>

          <div className="flex items-center gap-2 border-b border-[#21283c] pb-2 font-mono text-xs">
            {[
              ['linux', 'Linux server (systemd, recommended)'],
              ['manual', 'Manual / dev (heartbeat only)'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded transition-colors ${
                  activeTab === key ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'linux' && (
            <div className="space-y-2">
              <p className="text-slate-400">
                Installs node_exporter, vmagent and infra-agent as systemd services. Only outbound HTTPS to the panel is needed.
              </p>
              <CommandBox command={linuxCommand} type="install" />
            </div>
          )}
          {activeTab === 'manual' && (
            <div className="space-y-2">
              <p className="text-slate-400">
                Runs only the heartbeat agent in the foreground (any OS with Node.js). Charts need the Linux installer.
              </p>
              <CommandBox command={manualCommand} type="manual" />
            </div>
          )}
        </div>

        {/* Step 3: live checklist */}
        <div className="space-y-2 p-4 rounded-xl border bg-[#111624] border-[#222c42]">
          <div className="font-bold text-white text-sm">3. Waiting for the server…</div>
          <ChecklistItem
            done={heartbeatFresh}
            label="Heartbeat received"
            hint={heartbeatFresh ? `Last heartbeat ${new Date(lastHeartbeat).toLocaleTimeString()}` : 'infra-agent reports every 5 s'}
          />
          <ChecklistItem
            done={metricsLive}
            label="Metrics arriving in Prometheus"
            hint={metricsLive ? 'Charts on this page are now live' : 'vmagent pushes every 15 s'}
          />
        </div>

        <div className="border-t border-[#1c2232] pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-2.5 rounded bg-[#0d0f15] border border-[#1c2232]">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>Real host metrics</span>
            </div>
            <p className="text-[11px] text-slate-400">node_exporter CPU, memory, disk, network and load every 15 s.</p>
          </div>
          <div className="p-2.5 rounded bg-[#0d0f15] border border-[#1c2232]">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span>Automatic alerts</span>
            </div>
            <p className="text-[11px] text-slate-400">CPU/RAM &gt;85% for 10 min, disk &gt;80%, or 3 min without heartbeat.</p>
          </div>
          <div className="p-2.5 rounded bg-[#0d0f15] border border-[#1c2232]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Outbound only</span>
            </div>
            <p className="text-[11px] text-slate-400">No inbound ports. Every request is authenticated with the server's token.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2232]">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
