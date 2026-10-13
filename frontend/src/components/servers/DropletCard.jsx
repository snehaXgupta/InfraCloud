import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  RefreshCw,
  Edit2,
  Trash2,
  Server as ServerIcon,
  Cpu,
  DollarSign,
  HardDrive,
  Layers,
  Sliders,
} from 'lucide-react';

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

  const getStatusBadge = (st) => {
    switch (st) {
      case 'healthy':
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            Ready
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            Warning
          </span>
        );
      case 'critical':
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border border-[#333] bg-[#111] text-[#888]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#666]" />
            {st}
          </span>
        );
    }
  };

  const status = server.status || 'healthy';

  return (
    <div
      onClick={() => (onOpen ? onOpen(server) : navigate(`/servers/${server._id}`))}
      className="group rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-400 dark:hover:border-[#333] p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div>
        {/* Top Header: Name, ID and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-white transition-colors flex items-center gap-2">
              <span>{server.name}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
            </h3>
            <p className="text-xs font-mono text-slate-500 dark:text-[#666] mt-0.5">
              ID {displayId}
            </p>
          </div>

          <div>{getStatusBadge(status)}</div>
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

            {/* Restart / Telemetry Sync */}
            <button
              onClick={() => onRestart && onRestart(server)}
              title="Restart / Run Operation"
              disabled={isOperating}
              className="p-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#222] hover:bg-slate-200 dark:hover:bg-[#141414] hover:border-slate-300 dark:hover:border-[#444] text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isOperating ? 'animate-spin text-blue-400' : ''}`} />
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
