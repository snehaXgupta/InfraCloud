import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sliders, CheckCircle2, XCircle, Loader2, Circle, MinusCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const APPROVER_ROLES = ['Platform Admin', 'DevOps / Infrastructure'];

const STATUS_STYLES = {
  pending_approval: 'bg-[#2a1d0b] border-amber-600/40 text-amber-300',
  queued: 'bg-[#0f1a2e] border-blue-600/40 text-blue-300',
  running: 'bg-[#0f1a2e] border-blue-500/60 text-blue-200',
  succeeded: 'bg-[#0e241b] border-emerald-600/40 text-emerald-300',
  failed: 'bg-[#2a0f12] border-red-700/60 text-red-300',
  rejected: 'bg-[#2a0f12] border-red-700/40 text-red-300',
  cancelled: 'bg-[#151924] border-[#2a3350] text-slate-400',
  expired: 'bg-[#151924] border-[#2a3350] text-slate-400',
};

const StepIcon = ({ status }) => {
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />;
  if (status === 'skipped') return <MinusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  return <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
};

const RequestCard = ({ r, me, onAction, money }) => {
  const [comment, setComment] = useState('');
  const isMine = r.requestedBy?._id === me?.id || r.requestedBy?._id === me?._id;
  const canDecide = r.status === 'pending_approval' && APPROVER_ROLES.includes(me?.role) && !isMine;
  const canCancel = ['pending_approval', 'queued'].includes(r.status) && (isMine || me?.role === 'Platform Admin');
  const showSteps = ['running', 'succeeded', 'failed'].includes(r.status);

  return (
    <div className="rounded-xl bg-[#11141c] border border-[#212636] p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/servers/${r.serverId?._id || r.serverId}`} className="text-sm font-bold text-white hover:text-blue-400">
              {r.serverName}
            </Link>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATUS_STYLES[r.status]}`}>
              {r.status.replace('_', ' ')}
            </span>
            {r.environmentType && <span className="text-[11px] text-slate-500">{r.environmentType}</span>}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-300">
            {r.fromPlan?.type} → <span className="text-white">{r.toPlan?.type}</span>{' '}
            <span className={r.monthlyCostDelta > 0 ? 'text-amber-300' : 'text-emerald-300'}>
              ({r.monthlyCostDelta > 0 ? '+' : ''}
              {money(r.monthlyCostDelta, r.currency)}/month)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Requested by {r.requestedBy?.name || 'unknown'} · {new Date(r.createdAt).toLocaleString()} · {r.provider}
            {r.scheduledFor && ` · runs at ${new Date(r.scheduledFor).toLocaleString()}`}
            {r.status === 'pending_approval' && r.expiresAt && ` · expires ${new Date(r.expiresAt).toLocaleString()}`}
          </div>
          <div className="mt-2 text-xs text-slate-300">“{r.reason}”</div>
          {r.decisions?.map((d, i) => (
            <div key={i} className="mt-1 text-[11px] text-slate-400">
              {d.decision === 'approved' ? '✓ Approved' : '✗ Rejected'} by {d.byName} · {new Date(d.at).toLocaleString()}
              {d.comment && ` — “${d.comment}”`}
            </div>
          ))}
        </div>

        {(canDecide || canCancel) && (
          <div className="flex flex-col gap-2 md:w-64 shrink-0">
            {canDecide && (
              <>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment (optional)"
                  className="px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-xs text-slate-200"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="success" className="flex-1" onClick={() => onAction(r._id, 'approve', comment)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => onAction(r._id, 'reject', comment)}>
                    Reject
                  </Button>
                </div>
              </>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => onAction(r._id, 'cancel')}>
                Cancel request
              </Button>
            )}
          </div>
        )}
        {r.status === 'pending_approval' && isMine && (
          <div className="text-[11px] text-slate-500 md:w-64">Waiting for a second person to approve.</div>
        )}
      </div>

      {showSteps && (
        <div className="space-y-1.5 border-t border-[#1c2232] pt-3">
          {r.steps.map((s) => (
            <div key={s.key} className="flex items-start gap-2 text-xs">
              <StepIcon status={s.status} />
              <div className={s.status === 'pending' ? 'text-slate-500' : 'text-slate-200'}>
                {s.label}
                {s.detail && <span className="text-slate-500"> — {s.detail}</span>}
              </div>
            </div>
          ))}
          {r.error && <div className="text-xs text-red-300 pt-1">Error: {r.error}</div>}
          {r.snapshotId && <div className="text-[11px] text-slate-500">Snapshot: {r.snapshotId}</div>}
        </div>
      )}
    </div>
  );
};

export const ResizeRequestsPage = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [filter, setFilter] = useState('recent');
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get(`/resize-requests?status=${filter}`);
      setRequests(res.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to load resize requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [filter]);

  // Poll while anything is waiting or running, so steps update live
  const live = requests.some((r) => ['queued', 'running', 'pending_approval'].includes(r.status));
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [live, filter]);

  const onAction = async (id, action, comment) => {
    try {
      await api.post(`/resize-requests/${id}/${action}`, comment ? { comment } : {});
      success({ approve: 'Approved — the resize is queued', reject: 'Request rejected', cancel: 'Request cancelled' }[action]);
      load();
    } catch (err) {
      showError(err.response?.data?.error || `Could not ${action}`);
    }
  };

  const money = (v, currency) => new Intl.NumberFormat([], { style: 'currency', currency: currency || 'USD' }).format(v || 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" /> Resize Requests
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Request → approval (production needs a second person) → snapshot → resize → verified by the agent.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-[#151924] border border-[#242c3f] text-xs">
          {[
            ['recent', 'Active & recent'],
            ['all', 'All'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded ${filter === key ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading resize requests..." />
      ) : requests.length ? (
        requests.map((r) => <RequestCard key={r._id} r={r} me={user} onAction={onAction} money={money} />)
      ) : (
        <div className="rounded-xl bg-[#11141c] border border-[#212636] p-8 text-center text-xs text-slate-400">
          {filter === 'recent' ? 'No resize waiting, running or finished in the last 24 hours. ' : 'No resize requests yet. '}
          Open a server and click <b>Resize</b> to request one.
        </div>
      )}
    </div>
  );
};
