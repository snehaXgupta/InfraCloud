import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Plus, RefreshCw, LifeBuoy, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { OperationModal } from '../components/servers/OperationModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const MANAGERS = ['Platform Admin', 'DevOps / Infrastructure'];
const REQUESTERS = ['Platform Admin', 'DevOps / Infrastructure', 'Project Admin'];

const STATE_STYLES = {
  Healthy: 'bg-[#0e241b] border-emerald-600/40 text-emerald-300',
  'Sync Verified': 'bg-[#0e241b] border-emerald-600/40 text-emerald-300',
  Degraded: 'bg-[#2a1d0b] border-amber-600/40 text-amber-300',
  'Sync Required': 'bg-[#2a0f12] border-red-700/60 text-red-300',
  'Primary Down': 'bg-[#2a0f12] border-red-700/60 text-red-300',
  'Sync Running': 'bg-[#0f1a2e] border-blue-500/60 text-blue-200',
  Unknown: 'bg-[#151924] border-[#2a3350] text-slate-400',
};

const input = 'mt-1 w-full px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-xs text-slate-200';

const ServerChip = ({ s, role }) => (
  <Link to={`/servers/${s?._id}`} className="flex-1 min-w-0 p-3 rounded-lg bg-[#0d0f15] border border-[#1c2232] hover:border-slate-500">
    <div className="text-[10px] uppercase font-mono text-slate-500">{role}</div>
    <div className="text-sm font-semibold text-white truncate">{s?.name || 'missing server'}</div>
    <div className={`text-[11px] ${s?.online ? 'text-emerald-300' : 'text-red-300'}`}>{s?.online ? `online · ${s.status}` : 'offline'}</div>
  </Link>
);

export const ReplicationPage = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [rels, setRels] = useState([]);
  const [servers, setServers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ primaryServerId: '', replicaServerId: '', kind: 'postgres', lagWarnSeconds: 60, lagCritSeconds: 300 });
  const [runFor, setRunFor] = useState(null); // { server, type, relationshipId }

  const load = async () => {
    try {
      const r = await api.get('/replication');
      setRels(r.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to load replication');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/servers').then((r) => setServers(r.data.data || [])).catch(() => {});
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/replication', { ...form, lagWarnSeconds: Number(form.lagWarnSeconds), lagCritSeconds: Number(form.lagCritSeconds) });
      success('Replica added — its agent starts reporting lag within a minute');
      setAddOpen(false);
      load();
    } catch (err) {
      showError(err.response?.data?.error || 'Could not add the replica');
    }
  };

  const remove = async (rel) => {
    if (!window.confirm(`Stop tracking ${rel.primary?.name} → ${rel.replica?.name}? The servers themselves are not changed.`)) return;
    try {
      await api.delete(`/replication/${rel._id}`);
      load();
    } catch (err) {
      showError(err.response?.data?.error || 'Could not remove');
    }
  };

  const openRun = (rel, type) => {
    const server = servers.find((s) => s._id === rel.replica?._id);
    if (!server) return showError('Replica server not found');
    setRunFor({ server, type, relationshipId: rel._id });
  };

  if (isLoading) return <LoadingSpinner fullPage label="Loading replication..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-400" /> Replication
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Primary → replica pairs. The replica’s agent measures lag locally; Sync and Recovery run on the replica after approval.
          </p>
        </div>
        {MANAGERS.includes(user?.role) && (
          <Button size="sm" onClick={() => setAddOpen(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add replica
          </Button>
        )}
      </div>

      {rels.map((rel) => (
        <div key={rel._id} className="rounded-xl bg-[#11141c] border border-[#212636] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATE_STYLES[rel.state]}`}>{rel.state}</span>
              <span className="text-xs text-slate-400">{rel.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'} streaming replication</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {REQUESTERS.includes(user?.role) && (
                <>
                  <Button size="xs" variant="secondary" onClick={() => openRun(rel, 'Sync')} leftIcon={<RefreshCw className="w-3 h-3" />}>
                    Sync
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => openRun(rel, 'Replica Recovery')} leftIcon={<LifeBuoy className="w-3 h-3" />}>
                    Recovery
                  </Button>
                </>
              )}
              {MANAGERS.includes(user?.role) && (
                <Button size="xs" variant="outline" onClick={() => remove(rel)} leftIcon={<Trash2 className="w-3 h-3" />}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            <ServerChip s={rel.primary} role="Primary" />
            <div className="flex flex-col items-center justify-center text-[11px] text-slate-400 px-1">
              <ArrowRight className="w-4 h-4" />
              <span className="font-mono">{rel.lastLagSeconds != null ? `${Math.round(rel.lastLagSeconds)} s lag` : 'no data'}</span>
            </div>
            <ServerChip s={rel.replica} role="Replica" />
          </div>

          {rel.recoveryOrder && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-700/50 bg-[#2a0f12] text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {rel.recoveryOrder}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-500">Thresholds</div>
              <div className="text-slate-200">warn {rel.lagWarnSeconds}s · critical {rel.lagCritSeconds}s</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-500">Last check</div>
              <div className="text-slate-200">{rel.lastCheckAt ? new Date(rel.lastCheckAt).toLocaleTimeString() : 'waiting for agent'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-500">Last sync</div>
              <div className="text-slate-200">
                {rel.lastSync?.at ? `${rel.lastSync.status} · ${new Date(rel.lastSync.at).toLocaleString()}` : 'never'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-500">Problem</div>
              <div className="text-slate-200">{rel.lastCheckError || '—'}</div>
            </div>
          </div>
        </div>
      ))}

      {!rels.length && (
        <div className="rounded-xl bg-[#11141c] border border-[#212636] p-8 text-center text-xs text-slate-400">
          No replicas tracked yet.{MANAGERS.includes(user?.role) && ' Click “Add replica” to pair a primary database server with its replica.'}
        </div>
      )}

      {addOpen && (
        <Modal isOpen onClose={() => setAddOpen(false)} title="Add replica" maxWidth="max-w-lg">
          <form onSubmit={create} className="space-y-3 text-xs text-slate-300">
            {[
              ['primaryServerId', 'Primary (source of truth) *'],
              ['replicaServerId', 'Replica (follows the primary) *'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-slate-400">{label}</span>
                <select required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={input}>
                  <option value="">Choose a server…</option>
                  {servers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} · {s.clientId?.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block">
              <span className="text-slate-400">Database *</span>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={input}>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL / MariaDB</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-400">Warning lag (s)</span>
                <input type="number" min="1" value={form.lagWarnSeconds} onChange={(e) => setForm({ ...form, lagWarnSeconds: e.target.value })} className={input} />
              </label>
              <label className="block">
                <span className="text-slate-400">Critical lag (s)</span>
                <input type="number" min="2" value={form.lagCritSeconds} onChange={(e) => setForm({ ...form, lagCritSeconds: e.target.value })} className={input} />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              On the replica server, Sync and Recovery run the owner’s own scripts set in <code>/etc/infra-agent/replication.conf</code> (SYNC_SCRIPT, RECOVERY_SCRIPT). Database credentials stay on the server.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2232]">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit">Add replica</Button>
            </div>
          </form>
        </Modal>
      )}

      {runFor && (
        <OperationModal
          isOpen
          server={runFor.server}
          initialType={runFor.type}
          initialParams={{ relationshipId: runFor.relationshipId }}
          onClose={() => {
            setRunFor(null);
            load();
          }}
          onOperationCompleted={load}
        />
      )}
    </div>
  );
};
