import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Workflow, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { OperationModal, StatusBadge, postCheckTone } from '../components/servers/OperationModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const APPROVER_ROLES = ['Platform Admin', 'DevOps / Infrastructure'];
const REQUESTER_ROLES = ['Platform Admin', 'DevOps / Infrastructure', 'Project Admin'];
const ACTIVE = ['Awaiting Approval', 'Queued', 'Dispatched', 'Running', 'Verifying'];

const duration = (ms) => (ms == null ? '' : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`);

const OperationRow = ({ op, me, onAction }) => {
  const [open, setOpen] = useState(ACTIVE.includes(op.status) && op.status !== 'Awaiting Approval');
  const [comment, setComment] = useState('');
  const mine = op.requestedBy?._id === (me?.id || me?._id);
  const canDecide = op.status === 'Awaiting Approval' && APPROVER_ROLES.includes(me?.role) && !mine;
  const canCancel = ['Awaiting Approval', 'Queued'].includes(op.status) && (mine || me?.role === 'Platform Admin');
  const params = op.parameters && Object.entries(op.parameters).filter(([k]) => !['sha256', 'relationshipId', 'lagWarnSeconds'].includes(k));

  return (
    <div className="rounded-xl bg-[#11141c] border border-[#212636] p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <button onClick={() => setOpen((v) => !v)} className="text-left flex items-start gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{op.operationType}</span>
              <StatusBadge status={op.status} />
              <span className="text-xs text-slate-400">
                on{' '}
                <Link to={`/servers/${op.serverId?._id || op.serverId}`} className="text-slate-200 hover:text-blue-400" onClick={(e) => e.stopPropagation()}>
                  {op.serverName || op.serverId?.name}
                </Link>
                {op.environmentType && ` · ${op.environmentType}`}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {op.requestedBy?.name || 'System'} · {new Date(op.createdAt).toLocaleString()}
              {op.completedAt && ` · took ${duration(op.executionTimeMs)}`}
              {params?.length ? ` · ${params.map(([k, v]) => `${k}: ${v}`).join(', ')}` : ''}
            </div>
            {op.reason && <div className="text-xs text-slate-300 mt-1">“{op.reason}”</div>}
            {op.decisions?.map((d, i) => (
              <div key={i} className="text-[11px] text-slate-400 mt-0.5">
                {d.decision === 'approved' ? '✓ Approved' : '✗ Rejected'} by {d.byName}
                {d.comment && ` — “${d.comment}”`}
              </div>
            ))}
            {op.postCheck?.detail && (
              <div className={`text-xs mt-1 ${{ green: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-300' }[postCheckTone(op.postCheck)]}`}>
                Post-check: {op.postCheck.detail}
              </div>
            )}
            {op.error && <div className="text-xs mt-1 text-red-300">{op.error}</div>}
          </div>
        </button>

        {(canDecide || canCancel) && (
          <div className="flex flex-col gap-2 md:w-60 shrink-0">
            {canDecide && (
              <>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment (optional)"
                  className="px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-xs text-slate-200"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="success" className="flex-1" onClick={() => onAction(op._id, 'approve', comment)}>Approve</Button>
                  <Button size="sm" variant="danger" className="flex-1" onClick={() => onAction(op._id, 'reject', comment)}>Reject</Button>
                </div>
              </>
            )}
            {canCancel && <Button size="sm" variant="outline" onClick={() => onAction(op._id, 'cancel')}>Cancel</Button>}
          </div>
        )}
        {op.status === 'Awaiting Approval' && mine && <div className="text-[11px] text-slate-500 md:w-60">Waiting for a second person to approve.</div>}
      </div>

      {open && (
        <pre className="max-h-72 overflow-auto p-3 rounded bg-[#090b10] border border-[#21283c] text-[11px] text-slate-300 whitespace-pre-wrap">
          {op.output || (ACTIVE.includes(op.status) ? 'Waiting for output…' : 'No output.')}
        </pre>
      )}
    </div>
  );
};

export const OperationsPage = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [operations, setOperations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [runOpen, setRunOpen] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/operations?status=${filter === 'active' ? 'active' : 'all'}`);
      setOperations(res.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to load operations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [filter]);

  const live = operations.some((o) => ACTIVE.includes(o.status));
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [live, filter]);

  const onAction = async (id, action, comment) => {
    try {
      await api.post(`/operations/${id}/${action}`, comment ? { comment } : {});
      success({ approve: 'Approved — queued for the agent', reject: 'Rejected', cancel: 'Cancelled' }[action]);
      load();
    } catch (err) {
      showError(err.response?.data?.error || `Could not ${action}`);
    }
  };

  const awaiting = operations.filter((o) => o.status === 'Awaiting Approval').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Workflow className="w-5 h-5 text-blue-400" /> Operations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Approved catalog only — the agent on each server runs its own built-in scripts. Risky operations need a second person’s approval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-lg bg-[#151924] border border-[#242c3f] text-xs">
            {[
              ['all', 'All'],
              ['active', `Active${awaiting ? ` · ${awaiting} to approve` : ''}`],
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
          {REQUESTER_ROLES.includes(user?.role) && (
            <Button size="sm" onClick={() => setRunOpen(true)} leftIcon={<Play className="w-3.5 h-3.5" />}>
              Run operation
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading operations..." />
      ) : operations.length ? (
        operations.map((op) => <OperationRow key={op._id} op={op} me={user} onAction={onAction} />)
      ) : (
        <div className="rounded-xl bg-[#11141c] border border-[#212636] p-8 text-center text-xs text-slate-400">No operations yet.</div>
      )}

      <OperationModal isOpen={runOpen} onClose={() => setRunOpen(false)} onOperationCompleted={load} />
    </div>
  );
};
