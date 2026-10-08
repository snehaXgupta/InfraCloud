import React, { useEffect, useState } from 'react';
import { Plug, RefreshCw, Link2, Trash2, Plus } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const STATUS_STYLES = {
  connected: 'bg-[#0e241b] border-emerald-600/40 text-emerald-300',
  error: 'bg-[#2a0f12] border-red-700/60 text-red-300',
  unverified: 'bg-[#151924] border-[#2a3350] text-slate-400',
};

const card = 'rounded-xl bg-[#11141c] border border-[#212636]';
const input = 'mt-1 w-full px-2 py-1.5 rounded bg-[#090b10] border border-[#21283c] text-xs text-slate-200';

// Link provider instances to inventory servers (needed for resize; matched by IP by default)
const LinkModal = ({ integration, onClose }) => {
  const { success, error: showError } = useToast();
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/integrations/${integration._id}/instances`)
      .then((res) => {
        setData(res.data);
        setChoice(Object.fromEntries(res.data.data.map((i) => [i.id, String(i.linkedServerId || i.suggestedServerId || '')])));
      })
      .catch((err) => {
        showError(err.response?.data?.error || 'Could not list instances');
        onClose();
      });
  }, [integration._id]);

  const save = async () => {
    setSaving(true);
    try {
      const links = data.data
        .filter((i) => String(i.linkedServerId || '') !== choice[i.id])
        .map((i) => ({ instanceId: i.id, serverId: choice[i.id] || null }));
      const res = await api.post(`/integrations/${integration._id}/link`, { links });
      success(`Linked ${res.data.data.linked}, unlinked ${res.data.data.unlinked}`);
      onClose(true);
    } catch (err) {
      showError(err.response?.data?.error || 'Could not save links');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => onClose()} title={`Link servers · ${integration.name}`} maxWidth="max-w-4xl">
      {!data ? (
        <LoadingSpinner label="Listing instances from the provider..." />
      ) : (
        <div className="space-y-4 text-xs text-slate-300">
          <p className="text-slate-400">
            Each instance in the provider account can be linked to one server in the panel. Matches by public IP are pre-selected.
          </p>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[#1c2232]">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#0d0f15] text-[10px] uppercase font-mono text-slate-500">
                <tr>
                  <th className="text-left font-medium p-2">Instance</th>
                  <th className="text-left font-medium p-2">IP</th>
                  <th className="text-left font-medium p-2">Plan</th>
                  <th className="text-left font-medium p-2">Linked server</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c2232]">
                {data.data.map((i) => (
                  <tr key={i.id}>
                    <td className="p-2">
                      <div className="text-white">{i.label}</div>
                      <div className="text-[10px] font-mono text-slate-500">{i.id}</div>
                    </td>
                    <td className="p-2 font-mono">{i.ip || '—'}</td>
                    <td className="p-2 font-mono">{i.plan}</td>
                    <td className="p-2">
                      <select
                        value={choice[i.id] || ''}
                        onChange={(e) => setChoice({ ...choice, [i.id]: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-[#090b10] border border-[#21283c] text-slate-200"
                      >
                        <option value="">— not linked —</option>
                        {data.servers.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} {s.ip ? `(${s.ip})` : ''}
                          </option>
                        ))}
                      </select>
                      {!i.linkedServerId && i.suggestedServerId && choice[i.id] === String(i.suggestedServerId) && (
                        <div className="text-[10px] text-amber-300 mt-0.5">Suggested by IP — saved only when you click Save links</div>
                      )}
                      {i.linkedServerId && <div className="text-[10px] text-emerald-400 mt-0.5">Linked</div>}
                    </td>
                  </tr>
                ))}
                {!data.data.length && (
                  <tr>
                    <td colSpan={4} className="p-3 text-slate-500">No instances in this account.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose()}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save links</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export const IntegrationsPage = () => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const isAdmin = user?.role === 'Platform Admin';
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'Vultr', apiKey: '', clientId: '' });
  const [linking, setLinking] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/integrations');
      setItems(res.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/clients').then((res) => setClients(res.data.data || [])).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/integrations', { ...form, clientId: form.clientId || undefined });
      const { check, plansSynced } = res.data;
      if (check.ok) success(`Connected (${check.account})${plansSynced ? ` · ${plansSynced} plan prices synced` : ''}`);
      else showError(`Saved, but the connection failed: ${check.error}`);
      setAddOpen(false);
      setForm({ name: '', provider: 'Vultr', apiKey: '', clientId: '' });
      load();
    } catch (err) {
      showError(err.response?.data?.error || 'Could not add integration');
    }
  };

  const act = async (i, action) => {
    if (action === 'delete' && !window.confirm(`Delete "${i.name}"? Its API key is removed and ${i.linkedServers} server(s) are unlinked.`)) return;
    setBusy(`${i._id}:${action}`);
    try {
      if (action === 'test') {
        const r = (await api.post(`/integrations/${i._id}/test`)).data.data;
        r.ok ? success(`Connection OK (${r.account})`) : showError(`Connection failed: ${r.error}`);
      } else if (action === 'sync') {
        const r = (await api.post(`/integrations/${i._id}/sync-plans`)).data.data;
        success(`${r.plansSynced} plan prices synced; costs updated`);
      } else if (action === 'delete') {
        await api.delete(`/integrations/${i._id}`);
        success('Integration deleted');
      }
      load();
    } catch (err) {
      showError(err.response?.data?.error || `Could not ${action}`);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <LoadingSpinner fullPage label="Loading integrations..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Plug className="w-5 h-5 text-blue-400" /> Integrations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Provider accounts used for resize and live plan prices. Monitoring does not need these — it uses the agent.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setAddOpen(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add provider account
          </Button>
        )}
      </div>

      {items.map((i) => (
        <div key={i._id} className={`${card} p-5 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div className="text-xs">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{i.name}</span>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${STATUS_STYLES[i.status]}`}>{i.status}</span>
            </div>
            <div className="mt-1 text-slate-400">
              {i.provider}
              {i.keyHint && ` · key …${i.keyHint}`}
              {` · ${i.clientId?.name || 'all clients'}`}
              {` · ${i.linkedServers} linked server${i.linkedServers === 1 ? '' : 's'}`}
              {i.lastCheckedAt && ` · checked ${new Date(i.lastCheckedAt).toLocaleString()}`}
            </div>
            {i.lastError && <div className="mt-1 text-red-300">{i.lastError}</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="xs" variant="secondary" disabled={busy === `${i._id}:test`} onClick={() => act(i, 'test')} leftIcon={<RefreshCw className="w-3 h-3" />}>
              Test
            </Button>
            {isAdmin && (
              <>
                <Button size="xs" variant="secondary" onClick={() => setLinking(i)} leftIcon={<Link2 className="w-3 h-3" />}>
                  Link servers
                </Button>
                {i.provider !== 'Simulated' && (
                  <Button size="xs" variant="secondary" disabled={busy === `${i._id}:sync`} onClick={() => act(i, 'sync')}>
                    Sync prices
                  </Button>
                )}
                <Button size="xs" variant="danger" onClick={() => act(i, 'delete')} leftIcon={<Trash2 className="w-3 h-3" />}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {!items.length && (
        <div className={`${card} p-8 text-center text-xs text-slate-400`}>
          No provider accounts yet.{isAdmin && ' Add a Vultr account (or the Simulated provider for demos) to resize servers from the panel.'}
        </div>
      )}

      {addOpen && (
        <Modal isOpen onClose={() => setAddOpen(false)} title="Add provider account" maxWidth="max-w-lg">
          <form onSubmit={create} className="space-y-3 text-xs text-slate-300">
            <label className="block">
              <span className="text-slate-400">Name *</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme — Vultr" className={input} />
            </label>
            <label className="block">
              <span className="text-slate-400">Provider *</span>
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={input}>
                <option value="Vultr">Vultr</option>
                <option value="Simulated">Simulated (demo — no real account)</option>
              </select>
            </label>
            {form.provider !== 'Simulated' && (
              <label className="block">
                <span className="text-slate-400">API key * (Vultr → Account → API; restrict it to this panel's IP)</span>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className={input}
                />
              </label>
            )}
            <label className="block">
              <span className="text-slate-400">Client (optional — limits who can see it)</span>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={input}>
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-slate-500">The key is encrypted before it is stored and is never shown again.</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#1c2232]">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit">Connect</Button>
            </div>
          </form>
        </Modal>
      )}

      {linking && (
        <LinkModal
          integration={linking}
          onClose={(changed) => {
            setLinking(null);
            if (changed) load();
          }}
        />
      )}
    </div>
  );
};
