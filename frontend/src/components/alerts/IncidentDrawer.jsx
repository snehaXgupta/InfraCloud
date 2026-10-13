import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  AlertTriangle,
  Server,
  Activity,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Zap,
  Cpu,
  HardDrive,
  Radio,
  FileText,
  Mail,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const IncidentDrawer = ({ alert, onClose, onAcknowledge, onResolve, onRefresh }) => {
  const { success, error: showError } = useToast();
  const [isDispatchingCheck, setIsDispatchingCheck] = useState(false);

  if (!alert) return null;

  const isCritical = alert.severity === 'Critical';
  const isServerDown = alert.metric === 'Heartbeat' || alert.metric === 'Server Down';

  // Automated Root-Cause Engine
  const getRootCauseAnalysis = (metric, value) => {
    switch (metric) {
      case 'Memory':
        return {
          probableCause: 'Resident set memory exhaustion (>95%). Probable memory leak in worker processes or unbounded Redis buffer allocation.',
          impact: 'Elevated latency, potential OOM-killer kernel termination of main node process.',
          recommendedAction: 'Inspect top memory consuming processes via Web Terminal and restart memory-hungry queue workers.',
        };
      case 'CPU':
        return {
          probableCause: 'Compute saturation above configured threshold. Intensive background encoding, runaway loop, or unindexed database query thread.',
          impact: 'Request queuing, dropped inbound connections, and elevated response times (>500ms).',
          recommendedAction: 'Execute top/htop probe via controlled operations to identify runaway thread PIDs.',
        };
      case 'Disk':
        return {
          probableCause: 'Root partition (/dev/vda1) storage saturation (>90%). Unrotated application log files or stale Docker build caches.',
          impact: 'Write failures on persistent databases, system journal logging failure, crash on temp file creation.',
          recommendedAction: 'Dispatch automated Disk Cleanup operation to purge old journals and Docker volume debris.',
        };
      case 'Heartbeat':
      case 'Server Down':
        return {
          probableCause: 'Agent daemon heartbeat stopped responding for >4 minutes. Host network interface offline or hypervisor freeze.',
          impact: 'Complete service outage for all applications and proxy routing hosted on this node.',
          recommendedAction: 'Check cloud provider console (DigitalOcean/AWS) and attempt hard power-cycle if unresponsive.',
        };
      default:
        return {
          probableCause: `Telemetry parameter ${metric} breached defined SLA threshold (${value}).`,
          impact: 'Subsystem performance degradation within isolated environment.',
          recommendedAction: 'Verify active microservice container metrics and review recent deployment history.',
        };
    }
  };

  const rootCause = getRootCauseAnalysis(alert.metric, alert.currentValue);

  // Dispatch instant automated health check probe
  const handleDispatchProbe = async () => {
    if (!alert.serverId?._id) return;
    setIsDispatchingCheck(true);
    try {
      const res = await api.post('/operations', {
        serverId: alert.serverId._id,
        operationType: 'Health Check',
      });
      if (res.data?.success) {
        success('Automated Health Check probe dispatched to server!');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to dispatch health probe');
    } finally {
      setIsDispatchingCheck(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-xl h-full bg-[#0a0a0a] border-l border-[#1f1f1f] shadow-2xl flex flex-col z-10 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#1f1f1f] bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                isServerDown
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : isCritical
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isServerDown ? 'SERVER DOWN' : isCritical ? 'CRITICAL INCIDENT' : 'WARNING ALERT'}
            </span>
            <span className="text-xs font-mono text-slate-400">
              ID: {String(alert._id).slice(-6)}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#161c2b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Title & Message */}
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {alert.metric} {alert.severity}: {alert.currentValue}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono leading-relaxed">
              {alert.message}
            </p>
          </div>

          {/* Target Host Details */}
          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] space-y-3">
            <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-zinc-300" />
              <span>Target Infrastructure Node</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {alert.serverId?.name || 'luxStag (Simulated Node)'}
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  IP: {alert.serverId?.network?.publicIp || '142.93.215.161'} · {alert.serverId?.provider || 'DigitalOcean'}
                </p>
              </div>

              {alert.serverId?._id && (
                <Link
                  to={`/servers/${alert.serverId._id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141414] border border-[#222222] hover:border-zinc-500 text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
                >
                  <span>View Droplet</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Metric Saturation & Telemetry Bar */}
          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase">Violation Severity</span>
              <span className="text-white font-bold">{alert.currentValue} (Threshold: {alert.threshold})</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#161616] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical ? 'bg-gradient-to-r from-amber-500 to-rose-500 w-[95%]' : 'bg-amber-500 w-[85%]'
                }`}
              />
            </div>
          </div>

          {/* Automated Root-Cause Diagnostic Engine */}
          <div className="p-4 rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase font-bold text-zinc-200">
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              <span>Automated Telemetry Diagnostic</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <p className="text-[11px] font-mono text-slate-500 uppercase">Probable Cause</p>
                <p className="text-slate-200 mt-0.5 leading-relaxed font-sans">{rootCause.probableCause}</p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-slate-500 uppercase">Impact Scope</p>
                <p className="text-slate-300 mt-0.5 leading-relaxed font-sans">{rootCause.impact}</p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-slate-500 uppercase">Remediation Runbook</p>
                <p className="text-zinc-200 mt-0.5 leading-relaxed font-sans font-medium">{rootCause.recommendedAction}</p>
              </div>
            </div>
          </div>

          {/* Incident Timeline Audit Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase font-semibold text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Incident Audit Timeline</span>
            </h4>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0e0e0e] border border-[#1f1f1f]">
                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <div>
                  <p className="text-slate-200 font-semibold">Incident Detected</p>
                  <p className="text-[11px] text-slate-500">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0e0e0e] border border-[#1f1f1f]">
                <div className="w-2 h-2 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-slate-200 font-semibold">Automated SMTP Dispatch</p>
                  <p className="text-[11px] text-slate-500">Alert email delivered to ops recipient</p>
                </div>
              </div>

              {alert.acknowledgedAt && (
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0e0e0e] border border-[#1f1f1f]">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-slate-200 font-semibold">Acknowledged</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(alert.acknowledgedAt).toLocaleString()} {alert.acknowledgedBy ? `by ${alert.acknowledgedBy.name || alert.acknowledgedBy}` : ''}
                    </p>
                  </div>
                </div>
              )}

              {alert.resolvedAt && (
                <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0e0e0e] border border-[#1f1f1f]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-slate-200 font-semibold">Resolved</p>
                    <p className="text-[11px] text-slate-500">{new Date(alert.resolvedAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Remediation Runbook Buttons */}
        <div className="p-4 border-t border-[#1f1f1f] bg-black flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {alert.serverId?._id && (
              <button
                onClick={handleDispatchProbe}
                disabled={isDispatchingCheck}
                className="px-3 py-1.5 rounded-md bg-[#141414] border border-[#222] hover:bg-[#1f1f1f] text-xs font-medium text-[#ccc] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-zinc-300" />
                <span>{isDispatchingCheck ? 'Probing...' : 'Dispatch Health Probe'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {alert.status === 'active' && (
              <button
                onClick={() => onAcknowledge(alert._id)}
                className="px-3 py-1.5 rounded-md bg-white/[0.08] border border-white/10 hover:bg-white/[0.15] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Acknowledge
              </button>
            )}

            {alert.status !== 'resolved' ? (
              <button
                onClick={() => onResolve(alert._id)}
                className="px-3.5 py-1.5 rounded-md bg-white text-black hover:bg-[#eaeaea] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark as Resolved</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4" /> Incident Closed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
