import React, { useState } from 'react';
import { RotateCw, AlertTriangle, Server } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export const RestartServerModal = ({ isOpen, onClose, server, onRestartCompleted }) => {
  const [reason, setReason] = useState('Manual reboot from control panel');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  if (!server) return null;

  const isActive = (server.status !== 'offline' && server.status !== 'inactive' && server.status !== 'stopped') &&
    (server.status === 'healthy' || server.status === 'active' || server.status === 'warning' || server.agent?.isLiveAgent || server.agent?.status === 'online');

  const handleRestart = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post(`/servers/${server._id}/restart`, { reason });
      if (res.data?.success) {
        success(res.data.message || `Restart initiated for ${server.name}`);
        if (onRestartCompleted) onRestartCompleted();
        onClose();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to dispatch restart signal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Restart Server"
      subtitle="Gracefully reboot operating system host"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleRestart} className="space-y-4">
        {/* Server Context Box */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-slate-200 dark:bg-[#1a1a1a] text-slate-700 dark:text-slate-300">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">{server.name}</div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {server.network?.publicIp || server.hostname || '—'} · {server.region || '—'}
              </div>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
              isActive
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-slate-400 dark:bg-slate-500'
              }`}
            />
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Warning Alert */}
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Rebooting server will cause brief downtime</p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
              Active SSH sessions, web traffic, and running services will temporarily pause while the host restarts (typically 30–90 seconds).
            </p>
          </div>
        </div>

        {/* Reason / Notes */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Reason / Audit Note
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Applying updates, maintenance reboot"
            className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#1f1f1f]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-md bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1f1f1f] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>{isSubmitting ? 'Restarting...' : 'Restart Server'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
