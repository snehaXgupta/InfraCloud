import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Plus,
  Edit2,
  CheckCircle2,
  Lock,
  UserCheck,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ROLES_DEFINITION = [
  {
    role: 'Platform Admin',
    desc: 'Unrestricted control plane governance, security policies, cloud credentials, and user lifecycle.',
    color: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    scope: 'Global Platform Scope',
  },
  {
    role: 'DevOps / Infrastructure',
    desc: 'Full server provisioning, controlled operation execution, metric diagnostics, and alert remediation.',
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    scope: 'Assigned Clients',
  },
  {
    role: 'Project Admin',
    desc: 'Manage environments, code repositories, deployment gates, and scoped servers within assigned projects.',
    color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    scope: 'Assigned Clients',
  },
  {
    role: 'Client Admin',
    desc: 'Manage projects, view billing SLAs, and assign stakeholder permissions within client organization.',
    color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    scope: 'Single Client Scope',
  },
  {
    role: 'Client Viewer',
    desc: 'Read-only telemetry insights, server uptime inspection, and public health status visibility.',
    color: 'border-slate-600 text-slate-300 bg-slate-800',
    scope: 'Read-Only Scoped',
  },
  {
    role: 'Auditor',
    desc: 'Full immutable compliance trail, security event logs, and operational governance inspection.',
    color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    scope: 'Compliance & Audit Scope',
  },
  {
    role: 'Billing / Finance',
    desc: 'Cost and usage visibility for assigned clients. No operations or user management.',
    color: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    scope: 'Assigned Clients',
  },
];

// Roles that see every client regardless of assignment (mirrors backend middleware/scope.js)
const GLOBAL_ROLES = ['Platform Admin', 'Auditor'];

const ClientScopePicker = ({ role, clients, value = [], onChange }) => {
  if (GLOBAL_ROLES.includes(role)) {
    return <p className="text-[11px] text-slate-400">This role can see every client.</p>;
  }
  const selected = new Set(value.map(String));
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  return (
    <div className="space-y-1.5">
      {clients.length === 0 && <p className="text-[11px] text-slate-500">No clients yet.</p>}
      {clients.map((c) => (
        <label key={c._id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={selected.has(String(c._id))} onChange={() => toggle(String(c._id))} />
          {c.name}
        </label>
      ))}
      {selected.size === 0 && (
        <p className="text-[11px] text-amber-400">No clients selected: this user will not see any servers.</p>
      )}
    </div>
  );
};

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Client Viewer',
    assignedClients: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      showError('Failed to fetch user directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    api
      .get('/clients')
      .then((res) => setClients(res.data?.data || []))
      .catch(() => setClients([]));
  }, []);

  const clientNames = (u) =>
    GLOBAL_ROLES.includes(u.role)
      ? 'All clients'
      : (u.assignedClients || [])
          .map((id) => clients.find((c) => String(c._id) === String(id))?.name)
          .filter(Boolean)
          .join(', ') || 'None';

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/users', formData);
      if (res.data?.success) {
        success(`User ${formData.name} created successfully!`);
        setIsAddUserOpen(false);
        setFormData({ name: '', email: '', password: '', role: 'Client Viewer', assignedClients: [] });
        fetchUsers();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await api.put(`/users/${editingUser._id}/role`, {
        role: editingUser.role,
        status: editingUser.status,
        assignedClients: GLOBAL_ROLES.includes(editingUser.role) ? [] : editingUser.assignedClients || [],
      });
      if (res.data?.success) {
        success(`Role updated for ${editingUser.name}`);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Users & Role-Based Access Control
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Scoped role definitions, operator privileges, and access governance across control-plane tiers
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddUserOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New User
        </Button>
      </div>

      {/* Role Scoping Matrix Showcase */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Platform RBAC Hierarchy Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLES_DEFINITION.map((r) => (
            <div
              key={r.role}
              className="p-3.5 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col justify-between"
            >
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${r.color}`}>
                  {r.role}
                </span>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{r.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                {r.scope}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Directory Table */}
      <Card>
        <CardHeader
          title="Operator Directory"
          subtitle={`Active control-plane accounts (${users.length})`}
          action={
            <div className="relative max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          }
        />
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner fullPage label="Loading user directory..." />
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] uppercase font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">User Profile</th>
                  <th className="px-5 py-3.5">Assigned RBAC Role</th>
                  <th className="px-5 py-3.5">Client Scope</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5">Member Since</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-5 py-3.5 font-sans">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-xs">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-blue-400 font-semibold text-xs">{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 font-sans text-[11px] text-slate-300">{clientNames(u)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.status === 'active' ? 'healthy' : 'neutral'} size="sm">
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {new Date(u.lastLogin || u.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setEditingUser({ ...u })}
                        leftIcon={<Edit2 className="w-3 h-3" />}
                      >
                        Edit Access
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="Provision New Platform User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Miller"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="jordan@infrastructure.internal"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Initial Password *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Platform Role Assignment *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {ROLES_DEFINITION.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role} ({r.scope})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Client Scope</label>
            <ClientScopePicker
              role={formData.role}
              clients={clients}
              value={formData.assignedClients}
              onChange={(assignedClients) => setFormData({ ...formData, assignedClients })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit access for ${editingUser?.name}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateRole} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Select New Role</label>
            <select
              value={editingUser?.role || 'DevOps / Infrastructure'}
              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {ROLES_DEFINITION.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Account Status</label>
            <select
              value={editingUser?.status || 'active'}
              onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="active">Active (Access Granted)</option>
              <option value="suspended">Suspended (Access Revoked)</option>
              <option value="pending">Pending Verification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Client Scope</label>
            <ClientScopePicker
              role={editingUser?.role}
              clients={clients}
              value={editingUser?.assignedClients}
              onChange={(assignedClients) => setEditingUser({ ...editingUser, assignedClients })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
