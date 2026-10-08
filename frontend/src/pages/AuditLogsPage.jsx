import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Search,
  RefreshCw,
  Eye,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const { success, error: showError } = useToast();

  const fetchAuditLogs = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const res = await api.get('/audit-logs');
      if (res.data?.success) {
        setLogs(res.data.data);
        if (showToast) success('Audit records synchronized');
      }
    } catch (err) {
      showError('Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesResource = resourceTypeFilter === 'all' || log.resourceType === resourceTypeFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesSearch =
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      log.resourceName?.toLowerCase().includes(search.toLowerCase()) ||
      log.ipAddress?.includes(search);

    return matchesResource && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            Compliance & Security Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of all user logins, infrastructure modifications, operation executions, and security events
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAuditLogs(true)}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
        >
          Refresh Logs
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, user, IP address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Resource Types</option>
            <option value="Server">Server</option>
            <option value="Operation">Operation</option>
            <option value="Alert">Alert</option>
            <option value="Client">Client</option>
            <option value="Project">Project</option>
            <option value="User">User</option>
            <option value="Auth">Auth</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Outcomes</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
            <option value="Warning">Warning</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner fullPage label="Syncing immutable security logs..." />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No audit records found"
              description="Audit trails will automatically record as actions are performed on the control plane."
            />
          ) : (
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-slate-950/70 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Action Event</th>
                  <th className="px-5 py-3.5">Operator</th>
                  <th className="px-5 py-3.5">Resource</th>
                  <th className="px-5 py-3.5">IP Address</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white font-semibold text-xs">{log.action}</span>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <div className="text-slate-200 text-xs">{log.userName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{log.userRole}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-blue-400">{log.resourceType}:</span>{' '}
                      <span className="text-slate-300 truncate max-w-[180px] inline-block align-bottom font-sans">
                        {log.resourceName || log.resourceId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{log.ipAddress}</td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          log.status === 'Success'
                            ? 'healthy'
                            : log.status === 'Warning'
                            ? 'warning'
                            : 'critical'
                        }
                        size="sm"
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Log Inspection Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Payload Details"
        subtitle={`Action: ${selectedLog?.action} • ${selectedLog?.ipAddress}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px]">OPERATOR</span>
              <p className="text-white font-semibold font-sans">{selectedLog?.userName} ({selectedLog?.userEmail})</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px]">ROLE</span>
              <p className="text-blue-400 font-semibold">{selectedLog?.userRole}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px]">RESOURCE</span>
              <p className="text-slate-200">{selectedLog?.resourceType} / {selectedLog?.resourceName}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px]">TIMESTAMP</span>
              <p className="text-slate-300">{new Date(selectedLog?.createdAt || Date.now()).toISOString()}</p>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Raw JSON Metadata Payload:</label>
            <pre className="code-box p-4 rounded-xl text-emerald-300 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-60">
              {JSON.stringify(selectedLog?.details || {}, null, 2)}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
