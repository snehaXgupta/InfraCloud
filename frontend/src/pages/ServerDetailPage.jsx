import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { copyToClipboardSafe } from '../services/clipboard';
import {
  ArrowLeft,
  RefreshCw,
  RotateCw,
  Sliders,
  TerminalSquare,
  Terminal,
  Globe,
  Lock,
  Copy,
  Check,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Server,
  Database,
  Building2,
  FolderGit2,
  Clock,
  ShieldCheck,
  Zap,
  ExternalLink,
  Plus,
  Trash2,
  Shield,
  Code,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Settings,
  Radio,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Badge, ServerStatusBadge, SeverityBadge, ProviderBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { OperationModal } from '../components/servers/OperationModal';
import { ResizeServerModal } from '../components/servers/ResizeServerModal';
import { RestartServerModal } from '../components/servers/RestartServerModal';
import { isServerActive } from '../components/servers/DropletCard';
import { WebTerminalConsole } from '../components/servers/WebTerminalConsole';
import { WebTerminalModal } from '../components/servers/WebTerminalModal';
import { InstallAgentModal } from '../components/servers/InstallAgentModal';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const formatAge = (date) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
};

// Shows where chart data comes from, so simulated or stale data is never mistaken for live telemetry.
const MetricSourceBadge = ({ metrics }) => {
  if (!metrics?.source) return null;

  let text;
  let tone;
  if (metrics.source === 'prometheus' && !metrics.isStale) {
    text = `Live · ${metrics.lastSampleAt ? formatAge(metrics.lastSampleAt) : 'Prometheus'}`;
    tone = 'bg-[#0e241b] border-emerald-600/40 text-emerald-400';
  } else if (metrics.source === 'prometheus') {
    text = metrics.lastSampleAt ? `Stale · last sample ${formatAge(metrics.lastSampleAt)}` : 'Stale · no recent samples';
    tone = 'bg-[#2a1d0b] border-amber-600/40 text-amber-400';
  } else if (metrics.source === 'simulated') {
    text = 'Simulated data';
    tone = 'bg-[#2a1d0b] border-amber-600/40 text-amber-400';
  } else {
    text = 'No telemetry';
    tone = 'bg-[#151924] border-[#242c3f] text-slate-400';
  }

  return (
    <span
      className={`px-2 py-0.5 rounded border text-[10px] font-mono font-medium ${tone}`}
      title={metrics.sourceReason || 'Prometheus via agent remote_write'}
    >
      {text}
    </span>
  );
};

const ServerDetailContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const canAccessTerminal = user?.effectivePermissions?.terminal !== false && (user?.effectivePermissions?.terminal === true || ['Platform Admin', 'DevOps / Infrastructure'].includes(user?.role));
  const chartColor = isDark ? '#ffffff' : '#09090b';
  const gridColor = isDark ? '#222222' : '#e5e5e5';
  const axisColor = isDark ? '#666666' : '#888888';

  const [server, setServer] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [cost, setCost] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [activeMetricTab, setActiveMetricTab] = useState('cpu'); // 'cpu' | 'memory' | 'disk' | 'network'
  const [activeTab, setActiveTab] = useState('filesystem'); // 'filesystem' | 'services' | 'processes' | 'alerts' | 'activity' | 'websites'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState(false);
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [comingSoonModal, setComingSoonModal] = useState(null);
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false);
  const [selectedVhostConfig, setSelectedVhostConfig] = useState(null);
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [newSiteData, setNewSiteData] = useState({
    domain: '',
    serverEngine: 'Nginx',
    port: 443,
    ssl: true,
    rootPath: '/var/www/html',
    proxyPass: '',
    phpVersion: 'Static SPA',
  });
  const { success, error: showError } = useToast();

  const handleAddWebsite = async (e) => {
    e.preventDefault();
    if (!newSiteData.domain.trim()) {
      showError('Please provide a domain name');
      return;
    }
    try {
      const res = await api.post(`/servers/${id}/websites`, newSiteData);
      if (res.data?.success) {
        success(`Website ${newSiteData.domain} registered successfully`);
        setIsAddSiteModalOpen(false);
        setNewSiteData({
          domain: '',
          serverEngine: server?.webServer?.type || 'Nginx',
          port: 443,
          ssl: true,
          rootPath: '/var/www/html',
          proxyPass: '',
          phpVersion: 'Static SPA',
        });
        fetchServerDetails();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to add website');
    }
  };

  const handleDeleteWebsite = async (siteId, domain) => {
    if (!window.confirm(`Are you sure you want to remove ${domain} from this server?`)) return;
    try {
      const res = await api.delete(`/servers/${id}/websites/${siteId}`);
      if (res.data?.success) {
        success(`Website ${domain} removed`);
        fetchServerDetails();
      }
    } catch (err) {
      showError('Failed to remove website');
    }
  };

  const handleSwitchEngine = async (newType) => {
    try {
      setIsSwitchingEngine(true);
      const res = await api.put(`/servers/${id}/web-server`, {
        type: newType,
        version:
          newType === 'Nginx'
            ? 'nginx/1.24.0 (Ubuntu)'
            : newType === 'Apache'
            ? 'Apache/2.4.52 (Ubuntu)'
            : 'Nginx/1.24.0 (SSL Proxy) + Apache/2.4.52',
        configPath:
          newType === 'Nginx'
            ? '/etc/nginx/nginx.conf'
            : newType === 'Apache'
            ? '/etc/apache2/apache2.conf'
            : '/etc/nginx/nginx.conf & /etc/apache2/apache2.conf',
      });
      if (res.data?.success) {
        success(`Active web server switched to ${newType}`);
        fetchServerDetails();
      }
    } catch (err) {
      showError('Failed to update web server engine');
    } finally {
      setIsSwitchingEngine(false);
    }
  };

  const fetchServerDetails = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const [serverRes, metricsRes] = await Promise.all([
        api.get(`/servers/${id}`),
        api.get(`/servers/${id}/metrics?timeRange=${timeRange}`),
      ]);

      if (serverRes.data?.success) setServer(serverRes.data.data);
      if (metricsRes.data?.success) setMetrics(metricsRes.data.data);

      if (showToast) success('Insights refreshed');
    } catch (err) {
      showError('Failed to load server insights');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Cost changes at most hourly, so load it once rather than on every 4 s refresh
  useEffect(() => {
    api
      .get(`/costs/servers/${id}`)
      .then((res) => setCost(res.data?.data || null))
      .catch(() => setCost(null));
  }, [id]);

  useEffect(() => {
    fetchServerDetails();
    const interval = setInterval(() => {
      fetchServerDetails(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [id, timeRange]);

  const copyToClipboard = async (text, fieldName) => {
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedField(fieldName);
      success(`Copied ${fieldName} to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      showError(`Unable to copy ${fieldName} automatically`);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      const res = await api.patch(`/alerts/${alertId}/acknowledge`);
      if (res.data?.success) {
        success('Alert acknowledged');
        fetchServerDetails();
      }
    } catch (err) {
      showError('Failed to acknowledge alert');
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      const res = await api.patch(`/alerts/${alertId}/resolve`);
      if (res.data?.success) {
        success('Alert marked as resolved');
        fetchServerDetails();
      }
    } catch (err) {
      showError('Failed to resolve alert');
    }
  };

  const telemetrySeries = useMemo(() => {
    if (!metrics?.series || !Array.isArray(metrics.series)) return [];
    return metrics.series.map((item) => {
      if (!item.timestamp) return item;
      try {
        const date = new Date(item.timestamp);
        const isSeconds = ['5m', '15m'].includes(timeRange);
        const isDays = ['7d', '30d'].includes(timeRange);
        let localLabel;
        if (isDays) {
          localLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } else {
          localLabel = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: isSeconds ? '2-digit' : undefined,
          });
        }
        return {
          ...item,
          label: localLabel,
          localTooltipTime: date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
      } catch (e) {
        return item;
      }
    });
  }, [metrics?.series, timeRange]);

  if (isLoading && !server) {
    return <LoadingSpinner fullPage label="Loading server telemetry..." />;
  }

  if (!server) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-[#888888]">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Server not found</h2>
        <button
          onClick={() => navigate('/servers')}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-xs hover:bg-slate-800 dark:hover:bg-[#eaeaea] transition-colors cursor-pointer"
        >
          Back to Servers
        </button>
      </div>
    );
  }

  const currentCpu = metrics?.currentSummary?.cpu ?? server.metricsSummary?.cpuUsage ?? 3.1;
  const currentMemory = metrics?.currentSummary?.memory ?? server.metricsSummary?.memoryUsage ?? 11.6;
  const currentDisk = metrics?.currentSummary?.disk ?? server.metricsSummary?.diskUsage ?? 57.3;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Back Button */}
      <div>
        <button
          onClick={() => navigate('/servers')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* 2. Main Server Overview Card */}
      <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-5 md:p-6 space-y-5">
        {/* Title & Actions Row (Clean, single-row layout) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{server.name}</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 ${
                isServerActive(server)
                  ? 'bg-[#0f291e] text-[#22c55e] border-[#166534]'
                  : 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isServerActive(server)
                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.9)] animate-pulse'
                    : 'bg-slate-400 dark:bg-slate-500'
                }`}
              />
              {isServerActive(server) ? (server.status === 'warning' ? 'WARNING' : 'HEALTHY') : 'INACTIVE'}
            </span>
          </div>

          {/* Action Toolbar — single elegant row */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {/* Resize Button */}
            <button
              onClick={() => setIsResizeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title="Resize & Capacity Management"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-700 dark:text-white" />
              <span>Resize</span>
            </button>

            {/* Restart Server Button */}
            <button
              onClick={() => setIsRestartModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-900/50 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Restart Server (Reboot Host)"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-700 dark:text-white" />
              <span>Restart</span>
            </button>

            {/* Live Agent / Install Agent Button */}
            <button
              onClick={() => setIsAgentModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                server.agent?.isLiveAgent
                  ? 'bg-[#0e241b] border-emerald-600/40 hover:bg-[#133326] text-emerald-400'
                  : 'bg-slate-100 dark:bg-[#141414] border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white'
              }`}
              title="Host Telemetry Agent"
            >
              <Activity className={`w-3.5 h-3.5 ${server.agent?.isLiveAgent ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{server.agent?.isLiveAgent ? 'Agent Online' : 'Agent'}</span>
            </button>

            {/* Web Terminal Button */}
            {canAccessTerminal && (
              <button
                onClick={() => setIsTerminalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                title="Open Web SSH Terminal"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Terminal</span>
              </button>
            )}

            {/* Sync / Refresh Button */}
            <button
              onClick={() => fetchServerDetails(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title="Refresh Insights"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin text-slate-900 dark:text-white' : ''}`} />
              <span>Sync</span>
            </button>

            {/* Primary Action: Run Operation */}
            <button
              onClick={() => setIsOpModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <TerminalSquare className="w-3.5 h-3.5" />
              <span>Run Operation</span>
            </button>
          </div>
        </div>

        {/* Region & Network Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-slate-500 dark:text-[#888888]">
          <div className="flex items-center gap-2 font-mono">
            <Server className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" />
            <span className="text-slate-700 dark:text-slate-300">{server.region || 'us-east-1'}</span>
            <span className="text-slate-400 dark:text-[#666666]">·</span>
            <span>{server.provider || 'DigitalOcean'}</span>
            <span className="text-slate-400 dark:text-[#666666]">·</span>
            <span className="text-slate-500 dark:text-[#888888]">ID {String(server._id || '').slice(-9)}</span>
          </div>

          {/* Network IPs Line with Copy Buttons */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono">
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-[#888888]" />
              <span className="text-slate-500 dark:text-[#888888]">Public:</span>
              <strong className="text-slate-900 dark:text-slate-200">{server.network?.publicIp || server.hostname || '139.59.74.30'}</strong>
              <button
                onClick={() => copyToClipboard(server.network?.publicIp || server.hostname || '139.59.74.30', 'Public IP')}
                className="text-slate-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer transition-colors"
                title="Copy Public IP"
              >
                {copiedField === 'Public IP' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 font-mono">
              <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666]" />
              <span className="text-slate-500 dark:text-[#888888]">Private:</span>
              <strong className="text-slate-700 dark:text-slate-300">{server.network?.privateIp || '10.139.144.235'}</strong>
              <button
                onClick={() => copyToClipboard(server.network?.privateIp || '10.139.144.235', 'Private IP')}
                className="text-slate-400 hover:text-black dark:hover:text-white p-0.5 cursor-pointer transition-colors"
                title="Copy Private IP"
              >
                {copiedField === 'Private IP' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Grid (Configuration, Slug, Monthly cost, Last refresh) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] block mb-1">Configuration</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
              {server.compute?.vcpu || server.vcpu || 4} vCPUs · {server.compute?.ramGb || server.ramGb || 8} GB RAM · {server.storage?.diskTotalGb || server.diskTotalGb || 50} GB
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] block mb-1">Instance Type</span>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              {server.instanceType || 's-4vcpu-8gb'}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] block mb-1">
              {cost?.rateSource === 'manual-rate' ? 'Monthly Rate' : 'Estimated Cost'}
            </span>
            {cost && Number.isFinite(cost.monthlyRate) ? (
              <Link
                to="/costs"
                className="text-xs font-bold text-slate-900 dark:text-white font-mono hover:text-black dark:hover:text-white transition-colors"
                title={`Month to date: ${cost.amount || 0} ${cost.currency || 'USD'} (${cost.label || 'Estimated'})`}
              >
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: cost.currency && cost.currency.length === 3 ? cost.currency : 'USD',
                }).format(cost.monthlyRate)} / mo
              </Link>
            ) : (
              <span className="text-xs font-bold text-slate-500 dark:text-[#888888] font-mono">—</span>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] block mb-1">Last Sync</span>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Stored Root Password Row */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1f1f1f] text-xs">
          <div className="flex items-center gap-3">
            <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-[#888888]" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Stored root password</span>
            <span className="font-mono text-slate-900 dark:text-slate-200 tracking-wider">
              {showPassword ? 'k8s-root-9f82@node' : '••••••••'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 text-slate-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => copyToClipboard('k8s-root-9f82@node', 'Root Password')}
              className="p-1 text-slate-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              title="Copy password"
            >
              {copiedField === 'Root Password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Insights Section */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Insights</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: CPU Usage */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Cpu className="w-4 h-4 text-slate-400 dark:text-[#666666]" />
                <span>CPU usage</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{currentCpu}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-slate-900 dark:bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, currentCpu))}%` }}
              />
            </div>
          </div>

          {/* Card 2: Memory Usage */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Layers className="w-4 h-4 text-slate-400 dark:text-[#666666]" />
                <span>Memory usage</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{currentMemory}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-slate-900 dark:bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, currentMemory))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Disk Usage */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <HardDrive className="w-4 h-4 text-slate-400 dark:text-[#666666]" />
                <span>Disk usage</span>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">{currentDisk}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-slate-900 dark:bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, currentDisk))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Chart Card */}
      <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Activity className="w-4 h-4 text-slate-700 dark:text-white" />
            <span>
              {activeMetricTab.toUpperCase()} · last {timeRange}
            </span>
            <MetricSourceBadge metrics={metrics} />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-[11px] text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              aria-label="Time range"
            >
              {['5m', '15m', '1h', '6h', '24h', '7d', '30d'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Metric Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111111] p-1 rounded-md border border-slate-200 dark:border-[#222222] text-[11px] font-mono">
              {['cpu', 'memory', 'disk', 'network'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveMetricTab(tab)}
                  className={`px-2 py-0.5 rounded transition-colors uppercase ${
                    activeMetricTab === tab
                      ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchServerDetails(true)}
              className="p-1.5 text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#191919] rounded-md transition-colors cursor-pointer"
              title="Refresh chart"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* High-Fidelity Area Chart */}
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetrySeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={isDark ? 0.25 : 0.12} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                stroke={axisColor}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
              />
              <YAxis
                stroke={axisColor}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, (dataMax) => (Number.isFinite(dataMax) && dataMax > 0 ? Math.max(20, Math.ceil(dataMax * 1.2)) : 100)]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] px-3 py-2 rounded-lg shadow-sm text-[11px] font-mono">
                        <p className="text-slate-500 dark:text-[#888888] mb-1">{payload[0]?.payload?.localTooltipTime || payload[0]?.payload?.timestamp || label}</p>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {activeMetricTab.toUpperCase()} : {payload[0]?.value}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey={activeMetricTab === 'network' ? 'networkIn' : activeMetricTab}
                stroke={chartColor}
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#chartGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. System Tabs: Filesystem, Services, Processes, Alerts, Operations */}
      <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] overflow-hidden">
        <div className="border-b border-slate-200 dark:border-[#1f1f1f] px-4 flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'filesystem', label: 'Filesystem' },
            { id: 'services', label: 'System Services' },
            { id: 'processes', label: 'Processes (Top)' },
            ...(canAccessTerminal ? [{ id: 'terminal', label: 'Terminal Console' }] : []),
            {
              id: 'alerts',
              label: `Alerts (${Array.isArray(server.alerts) ? server.alerts.filter((a) => a && a.status !== 'resolved').length : 0})`,
            },
            { id: 'activity', label: 'Operations Activity' },
            {
              id: 'websites',
              label: `Hosted Websites (${(server.websites || server.systemInsights?.websites || []).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Tab 1: Filesystem */}
          {activeTab === 'filesystem' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                  <tr>
                    <th className="px-4 py-2.5">Filesystem Device</th>
                    <th className="px-4 py-2.5">Mounted On</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Used</th>
                    <th className="px-4 py-2.5">Available</th>
                    <th className="px-4 py-2.5">Use %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f]">
                  {server.systemInsights?.filesystem?.map((fs, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{fs.filesystem}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{fs.mount}</td>
                      <td className="px-4 py-3">{fs.size}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-[#888888]">{fs.used}</td>
                      <td className="px-4 py-3 text-emerald-500 dark:text-emerald-400">{fs.avail}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 dark:bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                            <div className="bg-slate-900 dark:bg-white h-full rounded-full" style={{ width: fs.usePercent }} />
                          </div>
                          <span>{fs.usePercent}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: System Services */}
          {activeTab === 'services' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                  <tr>
                    <th className="px-4 py-2.5">Service Name</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">PID</th>
                    <th className="px-4 py-2.5">Memory</th>
                    <th className="px-4 py-2.5">CPU</th>
                    <th className="px-4 py-2.5">Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f]">
                  {server.systemInsights?.runningServices?.map((srv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{srv.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0f291e] text-[#22c55e] border border-[#166534]">
                          {srv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-[#888888]">{srv.pid}</td>
                      <td className="px-4 py-3">{srv.memory}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{srv.cpu}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-[#888888]">{srv.uptime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Processes */}
          {activeTab === 'processes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                  <tr>
                    <th className="px-4 py-2.5">PID</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">CPU %</th>
                    <th className="px-4 py-2.5">MEM %</th>
                    <th className="px-4 py-2.5">Command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f]">
                  {server.systemInsights?.activeProcesses?.map((proc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-3 text-slate-500 dark:text-[#888888]">{proc.pid}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-[#888888]">{proc.user}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{proc.cpu}%</td>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{proc.mem}%</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{proc.command}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Alerts */}
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {server.alerts?.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-[#888888]">
                  No alerts recorded for this server instance.
                </div>
              ) : (
                server.alerts.map((alert) => (
                  <div
                    key={alert._id}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1f1f1f] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <span className="font-semibold text-slate-900 dark:text-white">{alert.metric} Alert</span>
                        <span className="text-slate-500 dark:text-[#888888] font-mono">
                          ({alert.currentValue} / threshold: {alert.threshold})
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{alert.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert._id)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-[11px] text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolveAlert(alert._id)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-[11px] text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Terminal Console */}
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              <WebTerminalConsole server={server} height="520px" />
            </div>
          )}

          {/* Tab 5: Operations History */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {server.operations?.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-[#888888]">
                  No operations dispatched on this server node yet.
                </div>
              ) : (
                server.operations.map((op) => (
                  <div key={op._id} className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1f1f1f] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TerminalSquare className="w-4 h-4 text-slate-700 dark:text-white" />
                        <span className="font-bold text-slate-900 dark:text-white">{op.operationType}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#0f291e] text-[#22c55e] border border-[#166534]">
                          {op.status}
                        </span>
                      </div>
                      <span className="text-slate-500 dark:text-[#888888] font-mono text-[11px]">
                        {new Date(op.createdAt).toLocaleString()} ({op.executionTimeMs}ms)
                      </span>
                    </div>

                    {op.output && (
                      <pre className="code-box p-3 rounded-lg text-[11px] text-slate-200 bg-slate-950 dark:bg-black border border-slate-800 dark:border-[#1f1f1f] overflow-x-auto whitespace-pre-wrap max-h-32 font-mono">
                        {op.output}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Hosted Websites & Web Services */}
          {activeTab === 'websites' && (
            <div className="space-y-6">
              {/* Web Server Engine Detection Banner (Nginx vs Apache) */}
              <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-5 space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Web Server Engine
                      </h3>
                      {(server.webServer?.type === 'Apache' || server.systemInsights?.webServer?.type === 'Apache') ? (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Apache HTTP Server
                        </span>
                      ) : (server.webServer?.type?.includes('Reverse Proxy') || server.systemInsights?.webServer?.type?.includes('Reverse Proxy')) ? (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          Nginx + Apache (Hybrid Proxy)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Nginx Web Engine
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Engine Quick Switcher */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#141414] p-1 rounded-lg border border-slate-200 dark:border-[#222222] text-xs">
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#777777] px-2 font-medium">
                      Engine:
                    </span>
                    {['Nginx', 'Apache', 'Nginx + Apache (Reverse Proxy)'].map((eng) => {
                      const isCurrent = (server.webServer?.type || server.systemInsights?.webServer?.type || 'Nginx') === eng;
                      return (
                        <button
                          key={eng}
                          disabled={isSwitchingEngine}
                          onClick={() => handleSwitchEngine(eng)}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-white dark:bg-[#252525] text-slate-900 dark:text-white font-semibold shadow-xs'
                              : 'text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white'
                          }`}
                        >
                          {eng === 'Nginx + Apache (Reverse Proxy)' ? 'Hybrid Proxy' : eng}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Engine Diagnostic Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-[#1a1a1a]">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#666666] block">Daemon Version</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {server.webServer?.version || server.systemInsights?.webServer?.version || 'nginx/1.24.0 (Ubuntu)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#666666] block">Listening Ports</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      Port 80 (HTTP) · Port 443 (HTTPS)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#666666] block">Main Config Path</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate block" title={server.webServer?.configPath || '/etc/nginx/nginx.conf'}>
                      {server.webServer?.configPath || server.systemInsights?.webServer?.configPath || '/etc/nginx/nginx.conf'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#666666] block">Service Status</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {server.webServer?.status || 'active (running)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hosted Websites & Virtual Hosts Section */}
              <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] overflow-hidden shadow-sm">
                {/* Section Header */}
                <div className="p-4 border-b border-slate-200 dark:border-[#1f1f1f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Hosted Websites
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1f1f1f] text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                      {(server.websites || server.systemInsights?.websites || []).length} active
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search domains..."
                      value={siteSearchQuery}
                      onChange={(e) => setSiteSearchQuery(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors w-40 sm:w-48"
                    />
                    <button
                      onClick={() => setIsAddSiteModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Website</span>
                    </button>
                  </div>
                </div>

                {/* Websites Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                      <tr>
                        <th className="px-4 py-3">Domain / Hostname</th>
                        <th className="px-4 py-3">Server Engine</th>
                        <th className="px-4 py-3">Port & SSL</th>
                        <th className="px-4 py-3">Document Root / Upstream</th>
                        <th className="px-4 py-3">Runtime</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f]">
                      {(server.websites || server.systemInsights?.websites || [])
                        .filter((site) =>
                          siteSearchQuery
                            ? site.domain.toLowerCase().includes(siteSearchQuery.toLowerCase())
                            : true
                        )
                        .map((site, idx) => {
                          const isHttps = site.ssl || site.port === 443;
                          const siteUrl = `${isHttps ? 'https' : 'http'}://${site.domain}`;
                          return (
                            <tr key={site._id || idx} className="hover:bg-slate-50/70 dark:hover:bg-[#111111] transition-colors">
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <a
                                    href={siteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 group"
                                  >
                                    <span>{site.domain}</span>
                                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-[#666666] mt-0.5">
                                  Target: {site.proxyPass ? site.proxyPass : site.rootPath}
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    site.serverEngine === 'Apache'
                                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {site.serverEngine || 'Nginx'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  {site.ssl ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-semibold text-[11px]">
                                      <Shield className="w-3 h-3" /> 443 (SSL)
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 dark:text-[#777777] text-[11px]">
                                      80 (HTTP)
                                    </span>
                                  )}
                                </div>
                                {site.ssl && (
                                  <div className="text-[10px] text-slate-400 dark:text-[#666666] mt-0.5">
                                    {site.sslProvider || "Let's Encrypt"}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="truncate max-w-xs text-slate-800 dark:text-slate-200" title={site.proxyPass || site.rootPath}>
                                  {site.proxyPass ? (
                                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                                      Proxy &rarr; {site.proxyPass}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-slate-600 dark:text-slate-300">
                                      {site.rootPath || '/var/www/html'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1a1a1a] text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                                  {site.phpVersion || 'Node.js 20 LTS'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {site.httpStatus || 200} OK
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedVhostConfig(site)}
                                    className="p-1 text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a1a1a] rounded transition-colors cursor-pointer"
                                    title="View VirtualHost Config"
                                  >
                                    <FileCode className="w-3.5 h-3.5" />
                                  </button>
                                  {site._id && (
                                    <button
                                      onClick={() => handleDeleteWebsite(site._id, site.domain)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors cursor-pointer"
                                      title="Remove Website"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {!(server.websites || server.systemInsights?.websites || []).length && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-[#888888]">
                            No websites or virtual hosts discovered on this server node yet. Click "Add Website" to register one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Website Modal */}
      <Modal
        isOpen={isAddSiteModalOpen}
        onClose={() => setIsAddSiteModalOpen(false)}
        title="Add Website / Virtual Host"
        subtitle={`Hosted on ${server.name} (${server.network?.publicIp || server.hostname})`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAddWebsite} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Domain / Subdomain *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. app.example.com or blog.infracontrol.io"
              value={newSiteData.domain}
              onChange={(e) => setNewSiteData({ ...newSiteData, domain: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Web Server Engine
              </label>
              <select
                value={newSiteData.serverEngine}
                onChange={(e) => setNewSiteData({ ...newSiteData, serverEngine: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              >
                <option value="Nginx">Nginx</option>
                <option value="Apache">Apache</option>
                <option value="Reverse Proxy">Reverse Proxy</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Port & Protocol
              </label>
              <input
                type="number"
                value={newSiteData.port}
                onChange={(e) => setNewSiteData({ ...newSiteData, port: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sslCheckbox"
              checked={newSiteData.ssl}
              onChange={(e) => setNewSiteData({ ...newSiteData, ssl: e.target.checked })}
              className="rounded border-slate-300 dark:border-[#333333] text-emerald-500 focus:ring-0"
            />
            <label htmlFor="sslCheckbox" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              Provision Let's Encrypt SSL Certificate (Auto-renewing HTTPS)
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Document Root (Static / PHP)
            </label>
            <input
              type="text"
              placeholder="/var/www/my-site/public"
              value={newSiteData.rootPath}
              onChange={(e) => setNewSiteData({ ...newSiteData, rootPath: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Upstream Reverse Proxy (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. http://127.0.0.1:3000 (for Node.js, Go, or Python)"
              value={newSiteData.proxyPass}
              onChange={(e) => setNewSiteData({ ...newSiteData, proxyPass: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Runtime / Stack
            </label>
            <select
              value={newSiteData.phpVersion}
              onChange={(e) => setNewSiteData({ ...newSiteData, phpVersion: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            >
              <option value="Node.js 20 LTS">Node.js 20 LTS</option>
              <option value="Static SPA">Static SPA (React / Vue / HTML)</option>
              <option value="PHP 8.2-FPM">PHP 8.2-FPM</option>
              <option value="Python 3.11 (WSGI)">Python 3.11 (WSGI)</option>
              <option value="Golang Daemon">Golang Daemon</option>
              <option value="Docker Container">Docker Container</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
            <button
              type="button"
              onClick={() => setIsAddSiteModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a1a1a] text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Add Virtual Host
            </button>
          </div>
        </form>
      </Modal>

      {/* View VHost Configuration Snippet Modal */}
      {selectedVhostConfig && (
        <Modal
          isOpen={!!selectedVhostConfig}
          onClose={() => setSelectedVhostConfig(null)}
          title={`VirtualHost Configuration · ${selectedVhostConfig.domain}`}
          subtitle={`${selectedVhostConfig.serverEngine || 'Nginx'} configuration block`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#888888]">
                Path: {selectedVhostConfig.serverEngine === 'Apache' ? `/etc/apache2/sites-available/${selectedVhostConfig.domain}.conf` : `/etc/nginx/sites-available/${selectedVhostConfig.domain}.conf`}
              </span>
              <button
                onClick={() => {
                  const conf = selectedVhostConfig.serverEngine === 'Apache'
                    ? `<VirtualHost *:${selectedVhostConfig.port || 443}>
    ServerName ${selectedVhostConfig.domain}
    DocumentRoot ${selectedVhostConfig.rootPath || '/var/www/html'}

    ${selectedVhostConfig.ssl ? `SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${selectedVhostConfig.domain}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${selectedVhostConfig.domain}/privkey.pem` : ''}

    ${selectedVhostConfig.proxyPass ? `ProxyPreserveHost On
    ProxyPass / ${selectedVhostConfig.proxyPass}/
    ProxyPassReverse / ${selectedVhostConfig.proxyPass}/` : `<Directory ${selectedVhostConfig.rootPath || '/var/www/html'}>
        AllowOverride All
        Require all granted
    </Directory>`}
</VirtualHost>`
                    : `server {
    listen ${selectedVhostConfig.port || (selectedVhostConfig.ssl ? '443 ssl http2' : '80')};
    server_name ${selectedVhostConfig.domain};
    root ${selectedVhostConfig.rootPath || '/var/www/html'};

    ${selectedVhostConfig.ssl ? `ssl_certificate /etc/letsencrypt/live/${selectedVhostConfig.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${selectedVhostConfig.domain}/privkey.pem;` : ''}

    ${selectedVhostConfig.proxyPass ? `location / {
        proxy_pass ${selectedVhostConfig.proxyPass};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }` : `location / {
        try_files $uri $uri/ /index.html;
    }`}
}`;
                  copyToClipboard(conf, 'VHost Config');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1a1a1a] text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Copy Snippet
              </button>
            </div>

            <pre className="p-4 rounded-xl text-[11px] text-emerald-400 bg-slate-950 dark:bg-black border border-slate-800 dark:border-[#1f1f1f] overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-96">
              {selectedVhostConfig.serverEngine === 'Apache'
                ? `<VirtualHost *:${selectedVhostConfig.port || 443}>
    ServerName ${selectedVhostConfig.domain}
    DocumentRoot ${selectedVhostConfig.rootPath || '/var/www/html'}

    ${selectedVhostConfig.ssl ? `SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${selectedVhostConfig.domain}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${selectedVhostConfig.domain}/privkey.pem` : ''}

    ${selectedVhostConfig.proxyPass ? `ProxyPreserveHost On
    ProxyPass / ${selectedVhostConfig.proxyPass}/
    ProxyPassReverse / ${selectedVhostConfig.proxyPass}/` : `<Directory ${selectedVhostConfig.rootPath || '/var/www/html'}>
        AllowOverride All
        Require all granted
    </Directory>`}
</VirtualHost>`
                : `server {
    listen ${selectedVhostConfig.port || (selectedVhostConfig.ssl ? '443 ssl http2' : '80')};
    server_name ${selectedVhostConfig.domain};
    root ${selectedVhostConfig.rootPath || '/var/www/html'};

    ${selectedVhostConfig.ssl ? `ssl_certificate /etc/letsencrypt/live/${selectedVhostConfig.domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${selectedVhostConfig.domain}/privkey.pem;` : ''}

    ${selectedVhostConfig.proxyPass ? `location / {
        proxy_pass ${selectedVhostConfig.proxyPass};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }` : `location / {
        try_files $uri $uri/ /index.html;
    }`}
}`}
            </pre>
          </div>
        </Modal>
      )}

      {/* Web Terminal Modal */}
      <WebTerminalModal
        isOpen={isTerminalModalOpen}
        server={server}
        onClose={() => setIsTerminalModalOpen(false)}
      />

      {/* Install Host Telemetry Agent Modal */}
      <InstallAgentModal
        isOpen={isAgentModalOpen}
        server={server}
        onClose={() => {
          setIsAgentModalOpen(false);
          fetchServerDetails();
        }}
      />

      {/* Resize & Capacity Modal */}
      <ResizeServerModal
        isOpen={isResizeModalOpen}
        server={server}
        onClose={() => setIsResizeModalOpen(false)}
        onResizeCompleted={() => fetchServerDetails()}
      />

      {/* Restart Server Modal */}
      <RestartServerModal
        isOpen={isRestartModalOpen}
        server={server}
        onClose={() => setIsRestartModalOpen(false)}
        onRestartCompleted={() => {
          setActiveTab('activity');
          fetchServerDetails(true);
        }}
      />

      {/* Operation Dispatch Modal */}
      <OperationModal
        isOpen={isOpModalOpen}
        server={server}
        onClose={() => setIsOpModalOpen(false)}
        onOperationCompleted={() => fetchServerDetails()}
      />

      {/* Coming Soon Modal */}
      <Modal
        isOpen={!!comingSoonModal}
        onClose={() => setComingSoonModal(null)}
        title={comingSoonModal?.title || 'Feature Notice'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] text-slate-900 dark:text-white">
            {comingSoonModal?.feature}
          </div>
          <p className="text-slate-500 dark:text-[#888888]">
            Phase 1 is strictly scoped to the unified control plane, telemetry ingestion, approved catalog actions, and RBAC compliance.
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setComingSoonModal(null)}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-xs hover:bg-slate-800 dark:hover:bg-[#eaeaea] transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const ServerDetailPage = () => {
  return (
    <ErrorBoundary>
      <ServerDetailContent />
    </ErrorBoundary>
  );
};
