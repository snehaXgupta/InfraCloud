import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Plus,
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { DropletCard } from '../components/servers/DropletCard';
import { AddServerModal } from '../components/servers/AddServerModal';
import { EditServerModal } from '../components/servers/EditServerModal';
import { DeleteServerModal } from '../components/servers/DeleteServerModal';
import { ResizeServerModal } from '../components/servers/ResizeServerModal';
import { OperationModal } from '../components/servers/OperationModal';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ServersPage = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // Default to droplet cards view as requested!
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editTargetServer, setEditTargetServer] = useState(null);
  const [deleteTargetServer, setDeleteTargetServer] = useState(null);
  const [resizeTargetServer, setResizeTargetServer] = useState(null);
  const [opTargetServer, setOpTargetServer] = useState(null);
  const { success, error: showError } = useToast();

  const fetchServers = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const res = await api.get('/servers');
      if (res.data?.success) {
        setServers(res.data.data);
        if (showToast) success('Droplet inventory synchronized');
      }
    } catch (err) {
      showError('Failed to fetch droplets');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const filteredServers = servers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.hostname && s.hostname.toLowerCase().includes(search.toLowerCase())) ||
      (s.network?.publicIp && s.network.publicIp.includes(search)) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesProvider = providerFilter === 'all' || s.provider === providerFilter;

    return matchesSearch && matchesStatus && matchesProvider;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Droplets
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchServers(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#141414] hover:border-slate-300 dark:hover:border-[#333333] text-xs font-medium text-slate-700 dark:text-[#ededed] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-[#888] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Droplet</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#0a0a0a] p-2.5 rounded-xl border border-slate-200 dark:border-[#1f1f1f] shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search droplets by name, IP, region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white font-mono transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="healthy">Active</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="offline">Offline</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            >
              <option value="all">All Providers</option>
              <option value="DigitalOcean">DigitalOcean</option>
              <option value="Vultr">Vultr</option>
              <option value="AWS">AWS</option>
              <option value="GCP">GCP</option>
              <option value="Azure">Azure</option>
              <option value="Hetzner">Hetzner</option>
              <option value="On-Premise">On-Premise</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111111] p-1 rounded-md border border-slate-200 dark:border-[#222222] shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            title="Card View (Droplets Grid)"
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Table View"
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              viewMode === 'table' ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingSpinner fullPage label="Syncing droplets inventory..." />
      ) : filteredServers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No droplets found"
          description="Try modifying your search or filters, or provision a new droplet instance."
          actionLabel="Add Droplet"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        /* Droplet Cards Grid View (Matching Screenshot 1) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServers.map((s) => (
            <DropletCard
              key={s._id}
              server={s}
              onOpen={() => navigate(`/servers/${s._id}`)}
              onRestart={(srv) => setOpTargetServer(srv)}
              onResize={(srv) => setResizeTargetServer(srv)}
              onEdit={(srv) => setEditTargetServer(srv)}
              onDelete={(srv) => setDeleteTargetServer(srv)}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                <tr>
                  <th className="px-4 py-3">Droplet Node</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Region / Provider</th>
                  <th className="px-4 py-3">Public IP</th>
                  <th className="px-4 py-3">Specs</th>
                  <th className="px-4 py-3">CPU</th>
                  <th className="px-4 py-3">RAM</th>
                  <th className="px-4 py-3">Disk</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f]">
                {filteredServers.map((s) => (
                  <tr
                    key={s._id}
                    className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors cursor-pointer"
                    onClick={() => navigate(`/servers/${s._id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs">{s.name}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{s.hostname}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {s.status === 'healthy' ? 'active' : s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-[#888888]">
                      {s.region} · {s.provider}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-mono">
                      {s.network?.publicIp || '142.93.215.161'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-[#888888]">
                      {s.compute?.vcpu || 4} vCPUs · {s.compute?.ramGb || 8} GB
                    </td>
                    <td className="px-4 py-3.5 text-slate-900 dark:text-white font-bold">
                      {s.metricsSummary?.cpuUsage}%
                    </td>
                    <td className="px-4 py-3.5 text-slate-900 dark:text-white font-bold">
                      {s.metricsSummary?.memoryUsage}%
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                      {s.metricsSummary?.diskUsage}%
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setResizeTargetServer(s)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-[11px] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          Resize
                        </button>
                        <button
                          onClick={() => navigate(`/servers/${s._id}`)}
                          className="px-2.5 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onServerCreated={() => fetchServers()}
      />

      <EditServerModal
        isOpen={!!editTargetServer}
        server={editTargetServer}
        onClose={() => setEditTargetServer(null)}
        onServerUpdated={() => fetchServers()}
      />

      <DeleteServerModal
        isOpen={!!deleteTargetServer}
        server={deleteTargetServer}
        onClose={() => setDeleteTargetServer(null)}
        onServerDeleted={() => fetchServers()}
      />

      <ResizeServerModal
        isOpen={!!resizeTargetServer}
        server={resizeTargetServer}
        onClose={() => setResizeTargetServer(null)}
        onResizeCompleted={() => fetchServers()}
      />

      <OperationModal
        isOpen={!!opTargetServer}
        server={opTargetServer}
        onClose={() => setOpTargetServer(null)}
        onOperationCompleted={() => fetchServers()}
      />
    </div>
  );
};
