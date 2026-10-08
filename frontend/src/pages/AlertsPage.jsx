import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  RefreshCw,
  Search,
  Sliders,
  Bell,
  Radio,
  Send,
} from 'lucide-react';
import { SeverityBadge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const AlertsPage = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, critical: 0, warning: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const { success, error: showError } = useToast();

  const fetchAlerts = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const res = await api.get('/alerts');
      if (res.data?.success) {
        setAlerts(res.data.data);
        setStats(res.data.stats || {});
        if (showToast) success('Alert statuses synchronized');
      }
    } catch (err) {
      showError('Failed to load alerts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAcknowledge = async (alertId) => {
    try {
      const res = await api.patch(`/alerts/${alertId}/acknowledge`);
      if (res.data?.success) {
        success('Alert acknowledged');
        fetchAlerts();
      }
    } catch (err) {
      showError('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      const res = await api.patch(`/alerts/${alertId}/resolve`);
      if (res.data?.success) {
        success('Alert marked as resolved');
        fetchAlerts();
      }
    } catch (err) {
      showError('Failed to resolve alert');
    }
  };

  const handleTriggerSimulation = async (type) => {
    setIsSimulating(true);
    try {
      const res = await api.post('/alerts/simulate', { type });
      if (res.data?.success) {
        success(res.data.message || `${type.toUpperCase()} alert triggered and emailed!`);
        fetchAlerts();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to simulate alert');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTestSMTP = async () => {
    setIsSendingTest(true);
    try {
      const res = await api.post('/alerts/test-smtp');
      if (res.data?.success) {
        success(res.data.message || 'Test alert email sent successfully!');
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to send test email. Check your .env SMTP settings.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchesSearch =
      a.message?.toLowerCase().includes(search.toLowerCase()) ||
      a.serverId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.metric?.toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesSeverity && matchesSearch;
  });

  // 7.5 Alert Configuration Matrix Table Data
  const defaultAlertRules = [
    { alert: 'CPU high', threshold: '>85% for 10 min', severity: 'Warning', type: 'warning' },
    { alert: 'CPU critical', threshold: '>95% for 10 min', severity: 'Critical', type: 'critical' },
    { alert: 'Memory high', threshold: '>85% for 10 min', severity: 'Warning', type: 'warning' },
    { alert: 'Memory critical', threshold: '>95% for 5 min', severity: 'Critical', type: 'critical' },
    { alert: 'Disk high', threshold: '>80%', severity: 'Warning', type: 'warning' },
    { alert: 'Disk critical', threshold: '>90%', severity: 'Critical', type: 'disk' },
    { alert: 'Heartbeat missing', threshold: '3–5 min grace period', severity: 'Critical', type: 'server-down' },
    { alert: 'Replica unhealthy', threshold: 'Configured health/lag rule', severity: 'Critical', type: 'critical' },
    { alert: 'Sync failed', threshold: 'Non-zero job result', severity: 'Critical', type: 'critical' },
    { alert: 'Agent outdated', threshold: 'Below policy version', severity: 'Info/Warning', type: 'warning' },
    { alert: 'Cost anomaly', threshold: 'Configured variance', severity: 'Warning', type: 'warning' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Infrastructure Alerts
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Active threshold violations, server down monitors, and automatic email notifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Simulation Trigger Buttons */}
          <button
            onClick={() => handleTriggerSimulation('warning')}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold text-amber-400 transition-colors shadow-sm cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Test Warning</span>
          </button>

          <button
            onClick={() => handleTriggerSimulation('critical')}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 transition-colors shadow-sm cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Test Critical</span>
          </button>

          <button
            onClick={() => handleTriggerSimulation('server-down')}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-700 hover:bg-red-900/60 text-xs font-semibold text-red-300 transition-colors shadow-sm cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>Test Server Down</span>
          </button>

          <button
            onClick={() => fetchAlerts(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-xs font-medium text-slate-200 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#11141c] border border-[#212636] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400">Total Active</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{stats.active || 0}</p>
          </div>
          <Activity className="w-5 h-5 text-blue-400" />
        </div>

        <div className="p-4 rounded-xl bg-[#11141c] border border-[#212636] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400">Critical Incidents</p>
            <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">{stats.critical || 0}</p>
          </div>
          <XCircle className="w-5 h-5 text-rose-400" />
        </div>

        <div className="p-4 rounded-xl bg-[#11141c] border border-[#212636] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400">Warnings</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.warning || 0}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>

        <div className="p-4 rounded-xl bg-[#11141c] border border-[#212636] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400">Acknowledged</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.acknowledged || 0}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* 7.5 Alert Configuration Matrix Table matching Screenshot */}
      <div className="rounded-xl bg-[#11141c] border border-[#212636] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#1c202c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white font-mono tracking-wide">
              7.5 Alerts Configuration Matrix
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Auto-evaluates every 30s &amp; dispatches SMTP emails</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-[#0d0f15] text-[11px] font-bold text-slate-300 border-b border-[#1c202c]">
              <tr>
                <th className="px-5 py-3">Alert</th>
                <th className="px-5 py-3">Example default</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3 text-right">Instant Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c202c]">
              {defaultAlertRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-[#131620] transition-colors">
                  <td className="px-5 py-3 font-semibold text-white">{rule.alert}</td>
                  <td className="px-5 py-3 text-slate-400">{rule.threshold}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rule.severity === 'Critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : rule.severity === 'Warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleTriggerSimulation(rule.type)}
                      disabled={isSimulating}
                      className="px-2.5 py-1 rounded bg-[#181c28] border border-[#262c3e] hover:bg-[#202638] text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Test Rule
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11141c] p-2.5 rounded-xl border border-[#212636] shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search active alerts by server, metric, or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d0f15] border border-[#212636] rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#0d0f15] border border-[#212636] rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="Warning">Warning</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0d0f15] border border-[#212636] rounded-md px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Live Alerts Feed Table */}
      {isLoading ? (
        <LoadingSpinner fullPage label="Syncing live alerts..." />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No alerts match the criteria"
          description="All systems are operating within configured telemetry thresholds."
        />
      ) : (
        <div className="rounded-xl bg-[#11141c] border border-[#212636] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0d0f15] text-[10px] uppercase font-mono text-slate-400 border-b border-[#1c202c]">
                <tr>
                  <th className="px-5 py-3.5">Severity</th>
                  <th className="px-5 py-3.5">Target Server</th>
                  <th className="px-5 py-3.5">Metric &amp; Value</th>
                  <th className="px-5 py-3.5">Threshold</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Triggered Time</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c202c] font-mono">
                {filteredAlerts.map((alert) => (
                  <tr key={alert._id} className="hover:bg-[#131620] transition-colors">
                    <td className="px-5 py-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <Link
                        to={`/servers/${alert.serverId?._id}`}
                        className="font-semibold text-white hover:text-blue-400 transition-colors"
                      >
                        {alert.serverId?.name || 'Server Node'}
                      </Link>
                      <div className="text-[11px] font-mono text-slate-400">{alert.serverId?.hostname}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-white">{alert.metric}:</span>{' '}
                      <span className={alert.severity === 'Critical' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                        {alert.currentValue}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{alert.threshold}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          alert.status === 'resolved'
                            ? 'bg-[#0f291e] text-[#22c55e] border border-[#166534]'
                            : alert.status === 'acknowledged'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-[#2d210b] text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {alert.status}
                      </span>
                      {alert.acknowledgedBy && (
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                          by {alert.acknowledgedBy.name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-[11px]">
                      {new Date(alert.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => handleAcknowledge(alert._id)}
                            className="px-2.5 py-1 rounded bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-[11px] text-slate-200 transition-colors cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert._id)}
                            className="px-2.5 py-1 rounded bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-[11px] text-slate-200 transition-colors cursor-pointer"
                          >
                            Resolve
                          </button>
                        )}
                        {alert.status === 'resolved' && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
