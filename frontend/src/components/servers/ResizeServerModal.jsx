import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sliders, ShieldCheck, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const REQUESTER_ROLES = ['Platform Admin', 'DevOps / Infrastructure', 'Project Admin'];

const Stat = ({ label, value, hint }) => (
  <div className="p-3 rounded-lg bg-[#0d0f15] border border-[#1c2232]">
    <div className="text-[10px] uppercase font-mono text-slate-500">{label}</div>
    <div className="text-sm font-bold text-white font-mono mt-0.5">{value}</div>
    {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

/**
 * Resize planning + request (discovery doc §10). Shows real usage, the sizes the provider allows
 * with their cost difference, and creates a resize request that goes through approval and the
 * background job. Nothing changes on the server from this window directly.
 */
export const ResizeServerModal = ({ isOpen, server, onClose, onResizeCompleted }) => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [plan, setPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [takeSnapshot, setTakeSnapshot] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const canRequest = REQUESTER_ROLES.includes(user?.role);

  useEffect(() => {
    if (!isOpen || !server?._id) return;
    setPlan(null);
    setCreated(null);
    setReason('');
    setScheduledFor('');
    setTakeSnapshot(true);
    setIsLoading(true);
    api
      .get(`/servers/${server._id}/resize-options`)
      .then((res) => {
        const data = res.data.data;
        setPlan(data);
        setSelected(data.candidates.find((c) => c.recommended)?.type || null);
      })
      .catch((err) => showError(err.response?.data?.error || 'Could not load resize options'))
      .finally(() => setIsLoading(false));
  }, [isOpen, server?._id]);

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat([], { style: 'currency', currency: plan?.currency || 'USD' });
    return (v) => (v == null ? '—' : fmt.format(v));
  }, [plan?.currency]);

  const target = plan?.candidates.find((c) => c.type === selected);

  const submit = async (e) => {
    e.preventDefault();
    if (!target) return showError('Choose a size first');
    setIsSubmitting(true);
    try {
      const res = await api.post(`/servers/${server._id}/resize-requests`, {
        targetPlan: target.type,
        reason,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        takeSnapshot,
      });
      setCreated(res.data.data);
      success(res.data.data.status === 'pending_approval' ? 'Resize requested — waiting for approval' : 'Resize queued');
      if (onResizeCompleted) onResizeCompleted();
    } catch (err) {
      showError(err.response?.data?.error || 'Could not create the resize request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !server) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resize server" subtitle={server.name} maxWidth="max-w-4xl">
      {isLoading || !plan ? (
        <LoadingSpinner label="Loading sizes and usage..." />
      ) : created ? (
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl border border-emerald-600/40 bg-[#0e241b] flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-white text-sm">
                {created.status === 'pending_approval' ? 'Request sent for approval' : 'Resize queued'}
              </div>
              <p className="text-slate-300 mt-1">
                {created.fromPlan?.type} → {created.toPlan.type} ({created.monthlyCostDelta >= 0 ? '+' : ''}
                {money(created.monthlyCostDelta)}/month).{' '}
                {created.status === 'pending_approval'
                  ? 'A second person (Platform Admin or DevOps) must approve it. Unapproved requests expire after 72 hours.'
                  : created.scheduledFor
                    ? `It will start at ${new Date(created.scheduledFor).toLocaleString()}.`
                    : 'It will start within a few seconds.'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Link to="/resize-requests" onClick={onClose}>
              <Button>Follow progress</Button>
            </Link>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 text-xs text-slate-300">
          {/* Current state */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Current plan" value={plan.current.type || '—'} hint={`${plan.current.vcpu ?? '—'} vCPU · ${plan.current.ramGb ?? '—'} GB RAM`} />
            <Stat label="Current price" value={`${money(plan.current.priceMonthly)}/mo`} hint={plan.current.priceSource.replace('-', ' ')} />
            <Stat
              label="CPU · 7 days"
              value={plan.utilization ? `${plan.utilization.p95Cpu ?? '—'}% p95` : 'No data'}
              hint={plan.utilization ? `avg ${plan.utilization.avgCpu ?? '—'}%` : 'needs the agent'}
            />
            <Stat
              label="Memory · 7 days"
              value={plan.utilization ? `${plan.utilization.p95Memory ?? '—'}% p95` : 'No data'}
              hint={plan.utilization ? `avg ${plan.utilization.avgMemory ?? '—'}%` : 'needs the agent'}
            />
          </div>

          <div className="p-3 rounded-lg border border-[#21283c] bg-[#111624]">
            <span className="font-bold text-white">{plan.recommendation.action}: </span>
            {plan.recommendation.message}
          </div>

          {/* Link / approval / downtime */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#0d0f15] border border-[#1c2232] flex gap-2">
              <Link2 className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <div className="font-semibold text-white">Provider</div>
                <div className="text-slate-400">
                  {plan.link ? `${plan.link.provider} · ${plan.link.integrationName}` : 'Not linked — plan only'}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#0d0f15] border border-[#1c2232] flex gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="font-semibold text-white">Approval</div>
                <div className="text-slate-400">
                  {plan.requiresApproval ? 'Production: a second person must approve' : 'Not required for this environment'}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#0d0f15] border border-[#1c2232] flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="font-semibold text-white">Downtime</div>
                <div className="text-slate-400">
                  {plan.downtime}
                  {plan.link && !plan.supportsDowngrade ? ' · upgrade only, cannot be undone' : ''}
                </div>
              </div>
            </div>
          </div>

          {plan.activeRequest && (
            <div className="p-3 rounded-lg border border-amber-600/40 bg-[#2a1d0b] text-amber-300">
              This server already has a resize request ({plan.activeRequest.status.replace('_', ' ')} →{' '}
              {plan.activeRequest.toPlan?.type}).{' '}
              <Link to="/resize-requests" className="underline" onClick={onClose}>
                View it
              </Link>
            </div>
          )}
          {!plan.executable && (
            <div className="p-3 rounded-lg border border-[#2a3350] bg-[#151924] text-slate-300">{plan.notExecutableReason}</div>
          )}

          {/* Sizes */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-[#1c2232]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0d0f15] text-[10px] uppercase font-mono text-slate-500">
                <tr>
                  <th className="text-left font-medium p-2 w-8" />
                  <th className="text-left font-medium p-2">Plan</th>
                  <th className="text-right font-medium p-2">vCPU</th>
                  <th className="text-right font-medium p-2">RAM</th>
                  <th className="text-right font-medium p-2">Disk</th>
                  <th className="text-right font-medium p-2">Price</th>
                  <th className="text-right font-medium p-2">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2232] font-mono">
                {plan.candidates.map((c) => (
                  <tr
                    key={c.type}
                    onClick={() => setSelected(c.type)}
                    className={`cursor-pointer ${selected === c.type ? 'bg-[#18243c]' : 'hover:bg-[#131620]'}`}
                  >
                    <td className="p-2">
                      <input type="radio" name="plan" checked={selected === c.type} onChange={() => setSelected(c.type)} aria-label={c.type} />
                    </td>
                    <td className="p-2 text-white">
                      {c.type}
                      {c.recommended && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300 text-[10px] font-sans">recommended</span>}
                    </td>
                    <td className="p-2 text-right">{c.vcpu}</td>
                    <td className="p-2 text-right">{c.ramGb} GB</td>
                    <td className="p-2 text-right">{c.diskGb} GB</td>
                    <td className="p-2 text-right text-white">{money(c.priceMonthly)}/mo</td>
                    <td className={`p-2 text-right ${c.monthlyCostDelta > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {c.monthlyCostDelta > 0 ? '+' : ''}
                      {money(c.monthlyCostDelta)}
                    </td>
                  </tr>
                ))}
                {!plan.candidates.length && (
                  <tr>
                    <td colSpan={7} className="p-3 font-sans text-slate-500">No other sizes available for this server.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Request */}
          {canRequest && plan.executable && !plan.activeRequest ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="md:col-span-2 block">
                <span className="text-slate-400">Reason *</span>
                <textarea
                  required
                  minLength={5}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Memory p95 above 85% all week; checkout slowing down"
                  className="mt-1 w-full px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-slate-200"
                />
              </label>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-slate-400">Run at (optional)</span>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-slate-200"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={takeSnapshot} onChange={(e) => setTakeSnapshot(e.target.checked)} />
                  Take a snapshot first
                </label>
              </div>
            </div>
          ) : (
            !canRequest && <p className="text-slate-500">Your role can view resize plans but not request a resize.</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1c2232]">
            <div className="text-slate-400">
              {target && (
                <>
                  {plan.current.type} → <span className="text-white font-mono">{target.type}</span> ·{' '}
                  <span className={target.monthlyCostDelta > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                    {target.monthlyCostDelta > 0 ? '+' : ''}
                    {money(target.monthlyCostDelta)}/month
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              {canRequest && plan.executable && !plan.activeRequest && (
                <Button type="submit" disabled={!target || isSubmitting} leftIcon={<Sliders className="w-3.5 h-3.5" />}>
                  {plan.requiresApproval ? 'Request approval' : 'Queue resize'}
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
