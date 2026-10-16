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
  Check,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const MODULES_DEFINITION = [
  { key: 'servers', label: 'Droplets / Servers', short: 'Servers', desc: 'Node telemetry, specs & state' },
  { key: 'terminal', label: 'Web Terminal', short: 'Terminal', desc: 'Interactive console shell access' },
  { key: 'operations', label: 'Operations & Scripts', short: 'Operations', desc: 'Pre-flight playbooks & runbooks' },
  { key: 'alerts', label: 'Alerts & Incidents', short: 'Alerts', desc: 'Threshold anomalies & notifications' },
  { key: 'costs', label: 'Costs & Billing', short: 'Costs', desc: 'Spend analysis & financial breakdown' },
  { key: 'auditLogs', label: 'Audit Trail', short: 'Audit', desc: 'Immutable compliance & security logs' },
  { key: 'users', label: 'User Directory', short: 'Users', desc: 'Operator lifecycle & RBAC policies' },
  { key: 'settings', label: 'Platform Settings', short: 'Settings', desc: 'Alert rules, notification mute & UI' },
];

export const DEFAULT_ROLE_PERMS = {
  'Platform Admin': { servers: true, terminal: true, operations: true, alerts: true, costs: true, auditLogs: true, users: true, settings: true },
  'DevOps / Infrastructure': { servers: true, terminal: true, operations: true, alerts: true, costs: false, auditLogs: true, users: false, settings: false },
  'Project Admin': { servers: true, terminal: false, operations: true, alerts: true, costs: false, auditLogs: false, users: false, settings: false },
  'Client Admin': { servers: true, terminal: false, operations: false, alerts: true, costs: true, auditLogs: false, users: false, settings: false },
  'Client Viewer': { servers: true, terminal: false, operations: false, alerts: true, costs: false, auditLogs: false, users: false, settings: false },
  'Auditor': { servers: true, terminal: false, operations: false, alerts: false, costs: true, auditLogs: true, users: false, settings: false },
  'Billing / Finance': { servers: false, terminal: false, operations: false, alerts: false, costs: true, auditLogs: false, users: false, settings: false },
};

export const ROLES_DEFINITION = [
  {
    role: 'Platform Admin',
    desc: 'Unrestricted control plane governance, security policies, cloud credentials, and user lifecycle.',
    color: 'border-slate-300 dark:border-white/20 text-slate-900 dark:text-white bg-slate-100 dark:bg-white/10',
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

const getRoleDefaults = (role, matrix) => {
  return matrix?.[role] || DEFAULT_ROLE_PERMS[role] || DEFAULT_ROLE_PERMS['Client Viewer'];
};

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
      disabled ? 'opacity-40 cursor-not-allowed' : ''
    } ${
      checked
        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
        : 'bg-slate-200 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333]'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-3.5 translate-y-0.5' : 'translate-x-0.5 translate-y-0.5'
      }`}
    />
  </button>
);

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
  const [roleMatrix, setRoleMatrix] = useState({});
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
    customPermissions: { ...DEFAULT_ROLE_PERMS['Client Viewer'] },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data?.success) {
        setUsers(res.data.data);
        if (res.data.roleMatrix) {
          setRoleMatrix(res.data.roleMatrix);
        }
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

  const openAddUserModal = () => {
    const role = 'Client Viewer';
    const defaults = getRoleDefaults(role, roleMatrix);
    setFormData({
      name: '',
      email: '',
      password: '',
      role,
      assignedClients: [],
      customPermissions: { ...defaults },
    });
    setIsAddUserOpen(true);
  };

  const handleAddRoleChange = (newRole) => {
    const defaults = getRoleDefaults(newRole, roleMatrix);
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      customPermissions: { ...defaults },
    }));
  };

  const toggleAddModule = (modKey) => {
    setFormData((prev) => ({
      ...prev,
      customPermissions: {
        ...prev.customPermissions,
        [modKey]: !prev.customPermissions?.[modKey],
      },
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/users', formData);
      if (res.data?.success) {
        success(`User ${formData.name} created successfully!`);
        setIsAddUserOpen(false);
        fetchUsers();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (u) => {
    const roleDefaults = getRoleDefaults(u.role, roleMatrix);
    const effective = u.effectivePermissions || { ...roleDefaults, ...(u.customPermissions || {}) };
    setEditingUser({
      ...u,
      customPermissions: { ...effective },
    });
  };

  const handleEditRoleChange = (newRole) => {
    const defaults = getRoleDefaults(newRole, roleMatrix);
    setEditingUser((prev) => ({
      ...prev,
      role: newRole,
      customPermissions: { ...defaults },
    }));
  };

  const toggleEditModule = (modKey) => {
    setEditingUser((prev) => ({
      ...prev,
      customPermissions: {
        ...prev.customPermissions,
        [modKey]: !prev.customPermissions?.[modKey],
      },
    }));
  };

  const resetEditToRoleDefaults = () => {
    if (!editingUser) return;
    const defaults = getRoleDefaults(editingUser.role, roleMatrix);
    setEditingUser((prev) => ({
      ...prev,
      customPermissions: { ...defaults },
    }));
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
        customPermissions: editingUser.customPermissions,
      });
      if (res.data?.success) {
        success(`Role & permissions updated for ${editingUser.name}`);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update user access');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-700 dark:text-white" />
            Users &amp; Role-Based Access Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#888888] mt-1">
            Manage control plane operators, client scoping, and granular module permissions.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={openAddUserModal}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New User
        </Button>
      </div>

      {/* Role Scoping Matrix Showcase */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-[#888888] font-semibold">
          Platform RBAC Hierarchy Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLES_DEFINITION.map((r) => (
            <div
              key={r.role}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-[#1f1f1f] bg-slate-50 dark:bg-[#0a0a0a] flex flex-col justify-between"
            >
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${r.color}`}>
                  {r.role}
                </span>
                <p className="text-[11px] text-slate-600 dark:text-[#888888] mt-2 leading-relaxed">{r.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-[#1f1f1f] text-[10px] font-mono text-slate-400 dark:text-[#666666]">
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
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              />
            </div>
          }
        />
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSpinner fullPage label="Loading user directory..." />
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-[#050505] text-[11px] uppercase font-mono text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                <tr>
                  <th className="px-5 py-3.5">User Profile</th>
                  <th className="px-5 py-3.5">Assigned Role &amp; Permissions</th>
                  <th className="px-5 py-3.5">Client Scope</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f] font-mono">
                {filteredUsers.map((u) => {
                  const roleDefaults = getRoleDefaults(u.role, roleMatrix);
                  const effective = u.effectivePermissions || { ...roleDefaults, ...(u.customPermissions || {}) };
                  const hasCustomOverrides =
                    u.customPermissions &&
                    Object.values(u.customPermissions).some((v) => typeof v === 'boolean');

                  return (
                    <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-[#111111] transition-colors">
                      <td className="px-5 py-3.5 font-sans">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-xs">{u.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-[#888888] font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-sans">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{u.role}</div>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer mt-0.5"
                          title="Click to view and edit module permissions"
                        >
                          <Shield className="w-3 h-3 text-slate-400" />
                          <span>{hasCustomOverrides ? 'Custom Permissions' : 'Role Policy'}</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[11px] text-slate-600 dark:text-slate-300">{clientNames(u)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={u.status === 'active' ? 'healthy' : 'neutral'} size="sm">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-[#888888] text-[11px]">
                        {new Date(u.lastLogin || u.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-[#888888] text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => handleOpenEdit(u)}
                          leftIcon={<Edit2 className="w-3 h-3" />}
                        >
                          Edit Access
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Provision New Platform User"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Jordan Miller"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="jordan@infrastructure.internal"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Initial Password *</label>
            <input
              type="password"
              required
              placeholder="•••••••• (minimum 8 characters)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Platform Role Assignment *</label>
            <select
              value={formData.role}
              onChange={(e) => handleAddRoleChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            >
              {ROLES_DEFINITION.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role} ({r.scope})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Client Scope</label>
            <ClientScopePicker
              role={formData.role}
              clients={clients}
              value={formData.assignedClients}
              onChange={(assignedClients) => setFormData({ ...formData, assignedClients })}
            />
          </div>

          {/* Granular Module Permissions Selector */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#1f1f1f]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Granular Module Permissions (RBAC)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-[#888888]">
                  Pre-filled with {formData.role} defaults. Toggle modules to customize this user's privileges.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, customPermissions: { ...getRoleDefaults(p.role, roleMatrix) } }))}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-[#090909] border border-slate-200 dark:border-[#1e1e1e]">
              {MODULES_DEFINITION.map((m) => {
                const isChecked = !!formData.customPermissions?.[m.key];
                return (
                  <div
                    key={m.key}
                    onClick={() => toggleAddModule(m.key)}
                    className={`flex items-start justify-between gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-white dark:bg-[#111111] border-slate-300 dark:border-white/20 text-slate-900 dark:text-white shadow-xs'
                        : 'bg-transparent border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-[#777] hover:bg-slate-100/50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>{m.label}</span>
                        <span
                          className={`text-[9px] font-mono px-1 rounded ${
                            isChecked
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'text-slate-400 dark:text-zinc-600'
                          }`}
                        >
                          {isChecked ? 'Allowed' : 'Denied'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-[#777] mt-0.5 leading-snug">{m.desc}</div>
                    </div>
                    <ToggleSwitch
                      checked={isChecked}
                      onChange={() => toggleAddModule(m.key)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role & Access Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit access for ${editingUser?.name}`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleUpdateRole} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Select Role</label>
              <select
                value={editingUser?.role || 'DevOps / Infrastructure'}
                onChange={(e) => handleEditRoleChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              >
                {ROLES_DEFINITION.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Account Status</label>
              <select
                value={editingUser?.status || 'active'}
                onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              >
                <option value="active">Active (Access Granted)</option>
                <option value="suspended">Suspended (Access Revoked)</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 dark:text-[#888888] mb-1">Client Scope</label>
            <ClientScopePicker
              role={editingUser?.role}
              clients={clients}
              value={editingUser?.assignedClients}
              onChange={(assignedClients) => setEditingUser({ ...editingUser, assignedClients })}
            />
          </div>

          {/* Granular Module Permissions Selector */}
          <div className="pt-2 border-t border-slate-200 dark:border-[#1f1f1f]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Granular Module Permissions (RBAC)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-[#888888]">
                  Custom overrides for this operator. These override the base {editingUser?.role} defaults.
                </p>
              </div>
              <button
                type="button"
                onClick={resetEditToRoleDefaults}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to role defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2.5 rounded-xl bg-slate-50 dark:bg-[#090909] border border-slate-200 dark:border-[#1e1e1e]">
              {MODULES_DEFINITION.map((m) => {
                const isChecked = !!editingUser?.customPermissions?.[m.key];
                return (
                  <div
                    key={m.key}
                    onClick={() => toggleEditModule(m.key)}
                    className={`flex items-start justify-between gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-white dark:bg-[#111111] border-slate-300 dark:border-white/20 text-slate-900 dark:text-white shadow-xs'
                        : 'bg-transparent border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-[#777] hover:bg-slate-100/50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>{m.label}</span>
                        <span
                          className={`text-[9px] font-mono px-1 rounded ${
                            isChecked
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'text-slate-400 dark:text-zinc-600'
                          }`}
                        >
                          {isChecked ? 'Allowed' : 'Denied'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-[#777] mt-0.5 leading-snug">{m.desc}</div>
                    </div>
                    <ToggleSwitch
                      checked={isChecked}
                      onChange={() => toggleEditModule(m.key)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
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
