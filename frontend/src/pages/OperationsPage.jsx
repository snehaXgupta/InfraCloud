import React, { useState, useEffect } from 'react';
import {
  TerminalSquare,
  Play,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Plus,
  Clock,
  User,
  Filter,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { APPROVED_OPERATIONS } from '../components/servers/OperationModal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const OperationsPage = () => {
  const [operations, setOperations] = useState([]);
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedType, setSelectedType] = useState('Health Check');
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeStdoutModal, setActiveStdoutModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const { success, error: showError } = useToast();

  const fetchData = async () => {
    try {
      const [opRes, srvRes] = await Promise.all([
        api.get('/operations'),
        api.get('/servers'),
      ]);
      if (opRes.data?.success) setOperations(opRes.data.data);
      if (srvRes.data?.success) {
        setServers(srvRes.data.data);
        if (srvRes.data.data.length > 0 && !selectedServerId) {
          setSelectedServerId(srvRes.data.data[0]._id);
        }
      }
    } catch (err) {
      showError('Failed to load operations history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedServerId || !selectedType) return;
    setIsDispatching(true);

    try {
      const res = await api.post('/operations', {
        serverId: selectedServerId,
        operationType: selectedType,
      });

      if (res.data?.success) {
        success(`Operation '${selectedType}' executed successfully`);
        setIsDispatchModalOpen(false);
        setActiveStdoutModal(res.data.data);
        fetchData();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to dispatch operation');
    } finally {
      setIsDispatching(false);
    }
  };

  const filteredOperations = operations.filter((op) => {
    if (statusFilter === 'all') return true;
    return op.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  const succeededCount = operations.filter((o) => o.status === 'Succeeded').length;
  const failedCount = operations.filter((o) => o.status === 'Failed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TerminalSquare className="w-6 h-6 text-emerald-400" />
            Controlled Operations Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audited infrastructure routines, zero shell vulnerability surface, and realtime execution logs
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsDispatchModalOpen(true)}
          leftIcon={<Play className="w-4 h-4 fill-current" />}
        >
          Dispatch Operation
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-surface-dark dark:bg-surface-darkCard flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Total Executions</div>
            <div className="text-2xl font-bold text-white font-mono mt-1">{operations.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <TerminalSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-surface-dark dark:bg-surface-darkCard flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Succeeded Routines</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{succeededCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-surface-dark dark:bg-surface-darkCard flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Active Managed Servers</div>
            <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">{servers.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Server className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Operations History Stream Table */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Operation Execution Stream</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical catalog dispatches and daemon telemetry logs ({filteredOperations.length})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="all">All Statuses</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner fullPage label="Syncing operations stream..." />
          ) : filteredOperations.length === 0 ? (
            <EmptyState
              icon={TerminalSquare}
              title="No operations recorded"
              description="Dispatch your first controlled operation on any server instance."
              actionLabel="Dispatch Operation"
              onAction={() => setIsDispatchModalOpen(true)}
            />
          ) : (
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-950/70 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Operation Type</th>
                  <th className="px-5 py-3.5">Target Server</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Initiator</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5 text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOperations.map((op) => (
                  <tr key={op._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white text-xs">{op.operationType}</div>
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <span className="text-slate-200 font-medium">{op.serverId?.name || 'Server Node'}</span>
                      <div className="text-[11px] font-mono text-slate-500">{op.serverId?.hostname}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={op.status === 'Succeeded' ? 'healthy' : op.status === 'Failed' ? 'critical' : 'warning'} size="sm">
                        {op.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <div className="text-slate-200">{op.requestedBy?.name || 'Operator'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{op.requestedBy?.role}</div>
                    </td>
                    <td className="px-5 py-4 text-cyan-400">{op.executionTimeMs}ms</td>
                    <td className="px-5 py-4 text-slate-400 text-[11px]">
                      {new Date(op.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-sans">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setActiveStdoutModal(op)}
                      >
                        View Output
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Expanded Dispatch Operation Modal with Square Cards */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Dispatch Controlled Infrastructure Action"
        subtitle="Select a target server and choose from pre-approved, audited catalog workflows."
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleDispatch} className="space-y-5">
          {/* Safety Guarantee Info Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-white">Safety Guarantee:</strong> Arbitrary shell commands (e.g.{' '}
              <code className="text-rose-400 font-mono">rm -rf</code> or unverified bash scripts) are strictly blocked.
              All operations execute through controlled sandbox runners with full audit records.
            </div>
          </div>

          {/* Target Server Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
              1. Select Target Server Instance *
            </label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              required
            >
              {servers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.hostname}) — [{s.provider} • {s.region}] — {s.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Approved Workflow Cards Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 font-mono">
              2. Select Pre-Approved Catalog Routine *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
              {APPROVED_OPERATIONS.map((op) => {
                const Icon = op.icon;
                const isSelected = selectedType === op.type;
                return (
                  <div
                    key={op.type}
                    onClick={() => setSelectedType(op.type)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between text-left relative ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500 shadow-lg shadow-blue-500/10'
                        : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-500/20' : 'bg-slate-800/60'}`}>
                            <Icon className={`w-4 h-4 ${op.color}`} />
                          </div>
                          <span className="text-xs font-bold text-white">{op.type}</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                            op.severity === 'Disruptive'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : op.severity === 'Safe'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {op.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {op.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-blue-500/30 flex items-center justify-between text-[11px] text-blue-400 font-mono font-medium">
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-blue-400" />
                          Selected Routine
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsDispatchModalOpen(false)} disabled={isDispatching}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isDispatching}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
            >
              Dispatch {selectedType}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Realtime Stdout Viewer Modal */}
      <Modal
        isOpen={!!activeStdoutModal}
        onClose={() => setActiveStdoutModal(null)}
        title={`Execution Output: ${activeStdoutModal?.operationType}`}
        subtitle={`Target: ${activeStdoutModal?.serverId?.name || 'Server'} • Duration: ${activeStdoutModal?.executionTimeMs}ms`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Execution Status: {activeStdoutModal?.status}
            </span>
            <span className="text-slate-500">
              Dispatched: {new Date(activeStdoutModal?.createdAt || Date.now()).toLocaleString()}
            </span>
          </div>

          <pre className="code-box p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96">
            {activeStdoutModal?.output || 'No output buffered.'}
          </pre>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setActiveStdoutModal(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
