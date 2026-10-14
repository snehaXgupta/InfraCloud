import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Server,
  Users,
  HardDrive,
  Copy,
  Activity,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { DropletCard } from '../components/servers/DropletCard';
import { AddServerModal } from '../components/servers/AddServerModal';
import { EditServerModal } from '../components/servers/EditServerModal';
import { DeleteServerModal } from '../components/servers/DeleteServerModal';
import { OperationModal } from '../components/servers/OperationModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [selectedServerForOp, setSelectedServerForOp] = useState(null);
  const [editTargetServer, setEditTargetServer] = useState(null);
  const [deleteTargetServer, setDeleteTargetServer] = useState(null);
  const { success, error: showError } = useToast();

  const fetchDashboardData = async (showToastNotice = false) => {
    try {
      if (showToastNotice) setIsRefreshing(true);
      const [dashRes, srvRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/servers'),
      ]);

      if (dashRes.data?.success) {
        setSummary(dashRes.data.data);
      }
      if (srvRes.data?.success) {
        setServers(srvRes.data.data);
      }
      if (showToastNotice) success('Dashboard metrics refreshed');
    } catch (err) {
      showError('Failed to fetch dashboard metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const counts = summary?.counts || {
    users: 8,
    activeUsers: 8,
    servers: servers.length || 0,
    activeServers: servers.length || 0,
    totalStorageUsedGb: 0,
  };

  const activities = summary?.activities || [
    {
      _id: '1',
      category: 'login',
      title: `User ${user?.email || 'puneet@simpel.ai'} logged in`,
      timestamp: new Date().toISOString(),
    },
    {
      _id: '2',
      category: 'login',
      title: `User ${user?.email || 'puneet@simpel.ai'} logged in`,
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      _id: '3',
      category: 'login',
      title: `User ${user?.email || 'puneet@simpel.ai'} logged in`,
      timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    },
    {
      _id: '4',
      category: 'logout',
      title: 'User logged out',
      timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  const formatActivityTime = (dateStr) => {
    if (!dateStr) return 'Sep 30, 2026, 05:49 AM';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}, ${d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}`;
  };

  // Compute format for storage used
  const formattedStorage = counts.totalStorageUsedGb
    ? counts.totalStorageUsedGb >= 1000
      ? `${(counts.totalStorageUsedGb / 1000).toFixed(1)} TB`
      : `${counts.totalStorageUsedGb} GB`
    : '0 B';

  const userDisplayName = user?.name ? user.name.split(' ')[0] : 'Puneet';

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Welcome Banner matching Vercel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white font-sans">
            Welcome back, {userDisplayName}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222222] hover:bg-slate-200 dark:hover:bg-[#141414] hover:border-slate-300 dark:hover:border-[#333333] text-xs font-medium text-slate-700 dark:text-[#ededed] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-[#888] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setIsAddServerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Droplet</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Cards matching Vercel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <div
          onClick={() => navigate('/users')}
          className="p-5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333333] transition-colors cursor-pointer flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#888888] text-xs font-medium">
            <span>Users</span>
            <Users className="w-4 h-4 text-slate-400 dark:text-[#666]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {counts.users || 8}
            </div>
            <div className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-mono">
              {counts.activeUsers || counts.users || 8} active
            </div>
          </div>
        </div>

        {/* Card 2: Spaces / Servers / Droplets */}
        <div
          onClick={() => navigate('/servers')}
          className="p-5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333333] transition-colors cursor-pointer flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#888888] text-xs font-medium">
            <span>Spaces</span>
            <Server className="w-4 h-4 text-slate-400 dark:text-[#666]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {servers.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-mono">
              {servers.filter((s) => s.status === 'healthy' || s.status === 'active').length} active
            </div>
          </div>
        </div>

        {/* Card 3: Storage Used */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333333] transition-colors flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#888888] text-xs font-medium">
            <span>Storage Used</span>
            <HardDrive className="w-4 h-4 text-slate-400 dark:text-[#666]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {formattedStorage}
            </div>
            <div className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-mono">
              {counts.totalStorageUsedGb ? `${servers.length} volumes` : '0 folders'}
            </div>
          </div>
        </div>

        {/* Card 4: Audit events */}
        <div
          onClick={() => navigate('/audit-logs')}
          className="p-5 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333333] transition-colors cursor-pointer flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#888888] text-xs font-medium">
            <span>Audit Events</span>
            <Copy className="w-4 h-4 text-slate-400 dark:text-[#666]" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {counts.totalAuditLogs ?? 0}
            </div>
            <div className="text-xs text-slate-500 dark:text-[#666666] mt-1 font-mono">
              {activities.length} recent shown
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Content: Spaces/Servers Overview (Left) + Activity Stream (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Section (8 cols on large screens): Spaces / Servers */}
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#1f1f1f]">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Spaces</h2>
              <Link
                to="/servers"
                className="text-xs text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Droplets list / Empty State */}
            {servers.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-slate-500 dark:text-[#888]">
                  No Spaces configured yet.{' '}
                  <button
                    onClick={() => setIsAddServerOpen(true)}
                    className="text-slate-900 dark:text-white hover:underline font-medium inline-flex items-center gap-1 ml-1 cursor-pointer"
                  >
                    Add your first Space &rarr;
                  </button>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                {servers.slice(0, 4).map((s) => (
                  <DropletCard
                    key={s._id}
                    server={s}
                    onOpen={() => navigate(`/servers/${s._id}`)}
                    onRestart={(srv) => setSelectedServerForOp(srv)}
                    onEdit={(srv) => setEditTargetServer(srv)}
                    onDelete={(srv) => setDeleteTargetServer(srv)}
                  />
                ))}
              </div>
            )}
          </div>

          {servers.length > 4 && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[#1f1f1f] flex justify-end">
              <Link
                to="/servers"
                className="text-xs text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                View all {servers.length} droplets &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Right Section (4 cols on large screens): Activity Feed matching Vercel */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 flex flex-col shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-[#1f1f1f]">
            <Activity className="w-4 h-4 text-slate-500 dark:text-[#888]" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Activity</h2>
          </div>

          <div className="mt-5 space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1">
            {activities.map((item) => (
              <div key={item._id} className="p-3 rounded-lg bg-slate-50 dark:bg-[#050505] border border-slate-100 dark:border-[#1a1a1a] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#222] bg-slate-100 dark:bg-[#111] text-slate-600 dark:text-[#888]">
                    {item.category || 'auth'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-[#666] font-mono">
                    {formatActivityTime(item.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-slate-700 dark:text-[#ededed] font-sans pt-1">
                  {item.title || `User ${user?.email || 'admin@simpel.ai'} authenticated`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddServerModal
        isOpen={isAddServerOpen}
        onClose={() => setIsAddServerOpen(false)}
        onServerCreated={() => fetchDashboardData()}
      />

      <EditServerModal
        isOpen={!!editTargetServer}
        server={editTargetServer}
        onClose={() => setEditTargetServer(null)}
        onServerUpdated={() => fetchDashboardData()}
      />

      <DeleteServerModal
        isOpen={!!deleteTargetServer}
        server={deleteTargetServer}
        onClose={() => setDeleteTargetServer(null)}
        onServerDeleted={() => fetchDashboardData()}
      />

      <OperationModal
        isOpen={!!selectedServerForOp}
        server={selectedServerForOp}
        onClose={() => setSelectedServerForOp(null)}
        onOperationCompleted={() => fetchDashboardData()}
      />
    </div>
  );
};
