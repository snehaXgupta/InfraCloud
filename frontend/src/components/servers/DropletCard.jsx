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

  const STATUS_STYLES = {
    healthy: 'bg-[#0e291e] text-[#22c55e] border-[#166534]',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-600/40',
    critical: 'bg-rose-950/60 text-rose-400 border-rose-600/40',
    offline: 'bg-slate-900 text-slate-400 border-slate-600',
    maintenance: 'bg-blue-950/60 text-blue-400 border-blue-600/40',
  };
  const status = server.status || 'healthy';

  return (
    <div
      onClick={() => (onOpen ? onOpen(server) : navigate(`/servers/${server._id}`))}
      className="group rounded-xl bg-[#10131b] border border-[#212636] hover:border-slate-500 p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div>
        {/* Top Header: Name, ID and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
              {server.name}
            </h3>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              ID {displayId}
            </p>
          </div>

          <div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${STATUS_STYLES[status] || STATUS_STYLES.healthy}`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Specs List Details */}
        <div className="mt-4 space-y-2 text-xs font-mono text-slate-400">
          {/* Location & IP */}
          <div className="flex items-center gap-2">
            <ServerIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-300">{region}</span>
            <span className="text-slate-200 font-semibold">{ip}</span>
          </div>

          {/* Compute / Specs */}
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-300">
              {server.instanceType || 'Custom'} · {vcpu} vCPUs · {ramGb} GB RAM · {diskGb} GB Disk
            </span>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <span>{price}/mo</span>
            {cost && cost.source !== 'plan-catalog' && cost.source !== 'manual-rate' && (
              <span className="text-[10px] font-normal text-slate-500">({cost.source === 'size-match' ? 'estimate' : 'unpriced'})</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions & Footer Section */}
      <div className="mt-5">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Primary Open Button */}
          <button
            onClick={() => (onOpen ? onOpen(server) : navigate(`/servers/${server._id}`))}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#0069ff] hover:bg-[#0055d4] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>

          {/* Restart / Telemetry Sync */}
          <button
            onClick={() => onRestart && onRestart(server)}
            title="Restart / Run Operation"
            disabled={isOperating}
            className="p-1.5 rounded-md bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOperating ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Resize & Capacity */}
          <button
            onClick={() => onResize && onResize(server)}
            title="Resize & Capacity Management"
            className="p-1.5 rounded-md bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Edit Server */}
          <button
            onClick={() => onEdit && onEdit(server)}
            title="Edit Server Configuration"
            className="p-1.5 rounded-md bg-[#131620] border border-[#262c3e] hover:bg-[#191d2a] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Server */}
          <button
            onClick={() => onDelete && onDelete(server)}
            title="Delete Droplet"
            className="p-1.5 rounded-md bg-[#131620] border border-[#262c3e] hover:bg-rose-950/40 hover:border-rose-700 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Updated Timestamp */}
        <p className="text-[11px] font-mono text-slate-500 mt-3.5">
          {formatUpdatedTime(server.updatedAt || server.createdAt)}
        </p>
      </div>
    </div>
  );
};
