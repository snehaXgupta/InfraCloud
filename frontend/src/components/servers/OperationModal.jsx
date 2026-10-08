import React, { useState } from 'react';
import {
  TerminalSquare,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  ShieldCheck,
  Cpu,
  Trash2,
  HardDrive,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const APPROVED_OPERATIONS = [
  {
    type: 'Health Check',
    description: 'Executes comprehensive kernel parameter validation, socket latency probe and storage diagnostics.',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    severity: 'Safe',
  },
  {
    type: 'Service Restart',
    description: 'Signals systemd unit service to gracefully drain connections and restart the target daemon PID.',
    icon: RefreshCw,
    color: 'text-blue-400',
    severity: 'Standard',
  },
  {
    type: 'Sync',
    description: 'Synchronizes desired state manifests, firewall iptables rules and TLS certificates from control plane.',
    icon: RefreshCw,
    color: 'text-cyan-400',
    severity: 'Standard',
  },
  {
    type: 'Replica Recovery',
    description: 'Checks WAL/binlog position against Primary instance and replays missing transaction streams.',
    icon: Database,
    color: 'text-purple-400',
    severity: 'Standard',
  },
  {
    type: 'Cleanup',
    description: 'Prunes rotated journal logs (>14d), cache buffers and dangling container layers to reclaim disk.',
    icon: Trash2,
    color: 'text-amber-400',
    severity: 'Safe',
  },
  {
    type: 'Agent Update',
    description: 'Upgrades the host telemetry daemon to newest verified release with zero-downtime hot-swap.',
    icon: Cpu,
    color: 'text-indigo-400',
    severity: 'Standard',
  },
  {
    type: 'Reboot',
    description: 'Dispatches graceful systemd kernel restart sequence and verifies telemetry daemon reconnection.',
    icon: AlertTriangle,
    color: 'text-rose-400',
    severity: 'Disruptive',
  },
];

export const OperationModal = ({ isOpen, onClose, server, onOperationCompleted }) => {
  const [selectedType, setSelectedType] = useState('Health Check');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const { success, error: showError } = useToast();

  const handleRunOperation = async () => {
    if (!server) return;
    setIsRunning(true);
    setExecutionResult(null);

    try {
      const res = await api.post('/operations', {
        serverId: server._id,
        operationType: selectedType,
      });

      if (res.data?.success) {
        setExecutionResult(res.data.data);
        success(`Operation '${selectedType}' finished successfully`);
        if (onOperationCompleted) {
          onOperationCompleted(res.data.data);
        }
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to dispatch operation');
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    setExecutionResult(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dispatch Controlled Operation"
      subtitle={`Target Server: ${server?.name || 'Unknown'} (${server?.hostname || ''})`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Safety Banner */}
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200 leading-relaxed">
            <strong>Control Plane Safety Guarantee:</strong> Operations are strictly constrained to pre-approved
            infrastructure catalogs. Arbitrary shell access is forbidden to prevent un-audited configuration drift.
          </div>
        </div>

        {/* Catalog Selector */}
        {!executionResult && (
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Select Approved Operation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {APPROVED_OPERATIONS.map((op) => {
                const isSelected = selectedType === op.type;
                const Icon = op.icon;
                return (
                  <div
                    key={op.type}
                    onClick={() => setSelectedType(op.type)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${op.color}`} />
                        <span className="text-xs font-semibold text-white">{op.type}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          op.severity === 'Disruptive'
                            ? 'bg-rose-500/20 text-rose-300'
                            : op.severity === 'Safe'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {op.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">{op.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Execution Output Terminal */}
        {executionResult && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-mono font-semibold text-emerald-400">Execution Output (Nominal)</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Duration: {executionResult.executionTimeMs}ms
              </span>
            </div>

            <div className="code-box rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
              {executionResult.output}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button variant="outline" onClick={handleClose}>
            {executionResult ? 'Done' : 'Cancel'}
          </Button>

          {!executionResult && (
            <Button
              variant={selectedType === 'Reboot' ? 'danger' : 'primary'}
              onClick={handleRunOperation}
              isLoading={isRunning}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
            >
              Run {selectedType}
            </Button>
          )}

          {executionResult && (
            <Button
              variant="secondary"
              onClick={() => setExecutionResult(null)}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Run Another Action
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
