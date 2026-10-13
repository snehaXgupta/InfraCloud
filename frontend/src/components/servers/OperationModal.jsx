import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const REQUESTER_ROLES = ['Platform Admin', 'DevOps / Infrastructure', 'Project Admin'];
const FINAL = ['Succeeded', 'Failed', 'Rejected', 'Cancelled', 'Expired'];

export const STATUS_STYLES = {
  'Awaiting Approval': 'bg-[#2a1d0b] border-amber-600/40 text-amber-300',
  Queued: 'bg-[#141414] border-[#2a2a2a] text-zinc-300',
  Dispatched: 'bg-[#141414] border-[#2a2a2a] text-zinc-300',
  Running: 'bg-[#181818] border-zinc-600 text-white',
  Verifying: 'bg-[#181818] border-zinc-600 text-white',
  Succeeded: 'bg-[#0e241b] border-emerald-600/40 text-emerald-300',
  Failed: 'bg-[#2a0f12] border-red-700/60 text-red-300',
  Rejected: 'bg-[#2a0f12] border-red-700/40 text-red-300',
  Cancelled: 'bg-[#141414] border-[#222222] text-zinc-400',
  Expired: 'bg-[#141414] border-[#222222] text-zinc-400',
};

const RISK_STYLES = {
  low: 'text-emerald-300',
  medium: 'text-amber-300',
  high: 'text-red-300',
};

// Post-check tone: a check that ran but found problems is amber, not green
export const postCheckTone = (pc) =>
  !pc?.ok ? 'red' : /^Issues found/.test(pc.detail || '') ? 'amber' : 'green';

export const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATUS_STYLES[status] || STATUS_STYLES.Cancelled}`}>
    {status}
  </span>
);

const input =
  'mt-1 w-full px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors';

/**
 * Run a catalog operation on a server (discovery doc §8). The panel never sends commands: the
 * agent runs its own built-in script for the chosen operation. Risky operations go to approval.
 *
 * Props: server (optional — a server picker is shown when missing), initialType, initialParams
 */
export const OperationModal = ({ isOpen, onClose, server: fixedServer, onOperationCompleted, initialType, initialParams }) => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [catalog, setCatalog] = useState([]);
  const [servers, setServers] = useState([]);
  const [serverId, setServerId] = useState('');
  const [type, setType] = useState(initialType || 'Health Check');
  const [service, setService] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [relationships, setRelationships] = useState([]);
  const [relationshipId, setRelationshipId] = useState(initialParams?.relationshipId || '');
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [op, setOp] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setOp(null);
    setReason('');
    setConfirmName('');
    setType(initialType || 'Health Check');
    setRelationshipId(initialParams?.relationshipId || '');
    api.get('/operations/catalog').then((r) => setCatalog(r.data.data)).catch(() => {});
    api.get('/replication').then((r) => setRelationships(r.data.data || [])).catch(() => setRelationships([]));
    if (!fixedServer) api.get('/servers').then((r) => setServers(r.data.data || [])).catch(() => {});
  }, [isOpen]);

  const server = fixedServer || servers.find((s) => s._id === serverId) || null;
  const entry = catalog.find((c) => c.type === type);
  const envType = server?.environmentId?.type;
  const needsApproval = entry && (entry.approval === 'always' || (entry.approval === 'production' && envType === 'Production'));
  const agentReady = (server?.agent?.capabilities || []).includes('jobs');
  const replicaRels = useMemo(
    () => relationships.filter((r) => server && (r.replica?._id === server._id || r.replicaServerId === server._id)),
    [relationships, server?._id]
  );

  useEffect(() => {
    if (entry?.replication && !relationshipId && replicaRels.length) setRelationshipId(replicaRels[0]._id);
    if (type === 'Service Restart' && !service && server?.allowedServices?.length) setService(server.allowedServices[0]);
  }, [type, replicaRels.length, server?._id]);

  // Follow the operation live until it finishes
  useEffect(() => {
    if (!op || FINAL.includes(op.status)) return undefined;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/operations/${op._id}`);
        setOp(r.data.data);
        if (FINAL.includes(r.data.data.status) && onOperationCompleted) onOperationCompleted(r.data.data);
      } catch {
        // retry on next tick
      }
    }, 2000);
    return () => clearInterval(t);
  }, [op?._id, op?.status]);

  const submit = async (e) => {
    e.preventDefault();
    if (!server) return showError('Choose a server');
    const parameters = {};
    if (type === 'Service Restart') parameters.service = service;
    if (type === 'Cleanup') parameters.dryRun = dryRun;
    if (entry?.replication) parameters.relationshipId = relationshipId;
    setSubmitting(true);
    try {
      const r = await api.post('/operations', { serverId: server._id, operationType: type, parameters, reason, confirmName });
      setOp(r.data.data);
      success(r.data.data.status === 'Awaiting Approval' ? 'Sent for approval' : 'Queued — the agent picks it up within seconds');
      if (onOperationCompleted) onOperationCompleted(r.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Could not start the operation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
  const canRequest = REQUESTER_ROLES.includes(user?.role);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run operation" subtitle={server ? server.name : 'Approved catalog only — no shell access'} maxWidth="max-w-2xl">
      {op ? (
        <div className="space-y-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            {op.status === 'Succeeded' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : ['Failed', 'Rejected', 'Expired'].includes(op.status) ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-zinc-300 animate-spin" />
            )}
            <span className="font-bold text-white text-sm">{op.operationType}</span>
            <StatusBadge status={op.status} />
          </div>
          {op.status === 'Awaiting Approval' && (
            <p className="text-amber-300">A second person (Platform Admin or DevOps) must approve it on the Operations page. It expires in 72 hours.</p>
          )}
          {['Queued', 'Dispatched'].includes(op.status) && <p className="text-slate-400">Waiting for the server’s agent to pick it up (usually under 10 seconds)…</p>}
          {op.status === 'Verifying' && <p className="text-slate-400">The agent reported back; waiting for the server to prove the result (e.g. come back after reboot)…</p>}
          {op.postCheck?.detail && (
            <div
              className={`p-2 rounded border ${
                { green: 'border-emerald-700/50 text-emerald-300', amber: 'border-amber-600/50 text-amber-300', red: 'border-red-700/50 text-red-300' }[postCheckTone(op.postCheck)]
              }`}
            >
              Post-check: {op.postCheck.detail}
            </div>
          )}
          {op.error && <div className="p-2 rounded border border-red-700/50 text-red-300">{op.error}</div>}
          <pre className="max-h-64 overflow-auto p-3 rounded bg-[#090b10] border border-[#21283c] text-[11px] text-slate-300 whitespace-pre-wrap">
            {op.output || 'No output yet…'}
          </pre>
          <div className="flex justify-end gap-2">
            <Link to="/operations" onClick={onClose}>
              <Button variant="secondary">Open Operations</Button>
            </Link>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 text-xs text-slate-300">
          {!fixedServer && (
            <label className="block">
              <span className="text-slate-400">Server *</span>
              <select required value={serverId} onChange={(e) => setServerId(e.target.value)} className={input}>
                <option value="">Choose a server…</option>
                {servers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.environmentId?.type ? `· ${s.environmentId.type}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {server && !agentReady && (
            <div className="p-3 rounded border border-amber-600/40 bg-[#2a1d0b] text-amber-300">
              This server’s agent can’t run operations yet. Open the server → <b>Agent</b> and run the install command to connect or update it.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {catalog.map((c) => (
              <button
                type="button"
                key={c.type}
                onClick={() => setType(c.type)}
                className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  type === c.type
                    ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-[#1a1a1a]'
                    : 'border-slate-200 dark:border-[#1f1f1f] bg-slate-50 dark:bg-[#0a0a0a] hover:border-slate-300 dark:hover:border-[#333]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{c.type}</span>
                  <span className={`text-[10px] uppercase font-mono ${RISK_STYLES[c.risk]}`}>{c.risk} risk</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#888888] mt-1">{c.description}</div>
              </button>
            ))}
          </div>

          {type === 'Service Restart' && (
            <label className="block">
              <span className="text-slate-500 dark:text-[#888888]">Service *</span>
              {server?.allowedServices?.length ? (
                <select value={service} onChange={(e) => setService(e.target.value)} className={input}>
                  {server.allowedServices.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-amber-400">No services are allowed on this server yet. Edit the server and add them under “Allowed services”.</p>
              )}
            </label>
          )}

          {type === 'Cleanup' && (
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Dry run (only report what would be freed)
            </label>
          )}

          {entry?.replication && (
            <label className="block">
              <span className="text-slate-500 dark:text-[#888888]">Replication *</span>
              {replicaRels.length ? (
                <select value={relationshipId} onChange={(e) => setRelationshipId(e.target.value)} className={input}>
                  {replicaRels.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.primary?.name} → {r.replica?.name} ({r.kind}, {r.state})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-amber-400">This server is not a replica. Sync always runs on the replica — set it up on the Replication page.</p>
              )}
            </label>
          )}

          {entry && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1f1f1f] text-slate-600 dark:text-[#888888]">
              {needsApproval ? <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" /> : <Play className="w-4 h-4 text-emerald-400 shrink-0" />}
              <div>
                {needsApproval ? 'Needs approval from a second person before it runs.' : 'Runs as soon as the agent picks it up.'} Time limit {Math.round(entry.timeoutSec / 60) || 1} min.
              </div>
            </div>
          )}

          {(needsApproval || entry?.risk !== 'low') && (
            <label className="block">
              <span className="text-slate-500 dark:text-[#888888]">Reason {needsApproval ? '*' : '(optional)'}</span>
              <input required={needsApproval} minLength={needsApproval ? 5 : 0} value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
            </label>
          )}

          {entry?.confirmName && server && (
            <label className="block p-3 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <span className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Type <b className="text-slate-900 dark:text-white font-mono">{server.name}</b> to confirm
              </span>
              <input required value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className={input} autoComplete="off" />
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {canRequest && (
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !server ||
                  !agentReady ||
                  (type === 'Service Restart' && !service) ||
                  (entry?.replication && !relationshipId) ||
                  (entry?.confirmName && confirmName !== server?.name)
                }
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                {needsApproval ? 'Request approval' : 'Run'}
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};
