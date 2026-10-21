import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  RotateCw,
  Edit2,
  Trash2,
  Server as ServerIcon,
  Cpu,
  DollarSign,
  HardDrive,
  Layers,
  Sliders,
} from 'lucide-react';

export const isServerActive = (server) => {
  if (!server) return false;

  // 1. If agent is online or live telemetry is actively reporting, server is running
  if (server.agent?.isLiveAgent || server.agent?.status === 'online') {
    return true;
  }

  // 2. If heartbeat was received in the last 3 minutes
  if (server.agent?.lastHeartbeat) {
    const diff = Date.now() - new Date(server.agent.lastHeartbeat).getTime();
    if (diff < 180000) return true;
  }

  const status = (server.status || '').toLowerCase();

  // 3. Known active statuses
  if (['healthy', 'active', 'warning'].includes(status)) {
    return true;
  }

  // 4. Otherwise inactive / offline
  return false;
};

export const DropletCard = ({
  server,
  onOpen,
  onRestart,
  onResize,
  onEdit,
  onDelete,
  isOperating = false,
}) => {
  const navigate = useNavigate();

  // Short display ID: the unique tail of the id (same format as the server detail page)
  const getDisplayId = (id) => (id ? id.toString().slice(-9) : '—');

  // Helper for formatted date
  const formatUpdatedTime = (dateStr) => {
    if (!dateStr) return 'Updated recently';
    const date = new Date(dateStr);
    return `Updated ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}, ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}`;
  };

  const vcpu = server.compute?.vcpu ?? '—';
  const ramGb = server.compute?.ramGb ?? '—';
  const diskGb = server.storage?.diskTotalGb ?? '—';
  const region = server.region || '—';
  const ip = server.network?.publicIp || '—';
  const displayId = getDisplayId(server._id);
  const cost = server.monthlyCost;
  const price = cost
    ? new Intl.NumberFormat([], { style: 'currency', currency: cost.currency || 'USD' }).format(cost.monthlyRate)
    : '—';

  const active = isServerActive(server);

  return (
    <div
      onClick={() => (onOpen ? onOpen(server) : navigate(`/servers/${server._id}`))}
      className="group relative overflow-hidden rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-400 dark:hover:border-[#333] p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
    >
      {/* Status Mark Over Droplet: Green if active, Grey if inactive */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 transition-colors ${
          active ? 'bg-emerald-500 shadow-[0_1px_6px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      />

      <div>
        {/* Top Header: Name, ID and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors flex items-center gap-2">
              {/* Active/Inactive dot symbol */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  active
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] ring-2 ring-emerald-500/20'
                    : 'bg-slate-400 dark:bg-slate-600 ring-2 ring-slate-400/20'
                }`}
                title={active ? 'Server is Running (Active)' : 'Server is Inactive (Offline)'}
              />
              <span className="truncate">{server.name}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
            </h3>
            <p className="text-xs font-mono text-slate-500 dark:text-[#666] mt-0.5">
              ID {displayId}
            </p>
          </div>

          <div className="shrink-0">
            {active ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span>Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#181818] text-slate-500 dark:text-slate-400">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500"></span>
                <span>Inactive</span>
              </span>
            )}
          </div>
        </div>

        {/* Specs List Details */}
        <div className="mt-4 space-y-2 text-xs font-mono text-slate-500 dark:text-[#888]">
          {/* Location & IP */}
          <div className="flex items-center gap-2">
            <ServerIcon className="w-3.5 h-3.5 text-slate-400 dark:text-[#666] shrink-0" />
            <span className="text-slate-600 dark:text-[#888]">{region}</span>
            <span className="text-slate-800 dark:text-[#ccc] font-semibold">{ip}</span>
          </div>

          {/* Compute / Specs */}
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-slate-400 dark:text-[#666] shrink-0" />
            <span className="text-slate-600 dark:text-[#888]">
              {server.instanceType || 'Custom'} · {vcpu} vCPUs · {ramGb} GB RAM · {diskGb} GB Disk
            </span>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-[#ededed] font-semibold">
            <span>{price}/mo</span>
            {cost && cost.source !== 'plan-catalog' && cost.source !== 'manual-rate' && (
              <span className="text-[10px] font-normal text-slate-400 dark:text-[#666]">({cost.source === 'size-match' ? 'estimate' : 'unpriced'})</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions & Footer Section */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#191919]">
        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            {/* Vercel White CTA Open Button */}
            <button
              onClick={() => (onOpen ? onOpen(server) : navigate(`/servers/${server._id}`))}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] text-xs font-medium transition-colors cursor-pointer shadow-sm"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            {/* Restart Server Host Button */}
            <button
              onClick={() => onRestart && onRestart(server)}
              title="Restart Server (Reboot)"
              disabled={isOperating}
              className="p-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-900/50 text-slate-600 dark:text-[#888] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isOperating ? 'animate-spin text-rose-500' : ''}`} />
            </button>

            {/* Resize & Capacity */}
            {onResize && (
              <button
                onClick={() => onResize(server)}
                title="Resize & Capacity Management"
                className="p-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] hover:bg-slate-200 dark:hover:bg-[#141414] hover:border-slate-300 dark:hover:border-[#444] text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit Server Info */}
            {onEdit && (
              <button
                onClick={() => onEdit(server)}
                title="Edit Settings"
                className="p-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] hover:bg-slate-200 dark:hover:bg-[#141414] hover:border-slate-300 dark:hover:border-[#444] text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Server */}
            {onDelete && (
              <button
                onClick={() => onDelete(server)}
                title="Delete Droplet"
                className="p-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] hover:bg-rose-50 dark:hover:bg-[#200808] hover:border-rose-300 dark:hover:border-rose-900/60 text-slate-400 dark:text-[#666] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Updated Timestamp */}
          <p className="text-[10px] font-mono text-slate-400 dark:text-[#666]">
            {formatUpdatedTime(server.updatedAt || server.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
};
