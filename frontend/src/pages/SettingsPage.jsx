import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Settings,
  Shield,
  Key,
  Database,
  Bell,
  Sliders,
  CheckCircle2,
  Server,
  TerminalSquare,
  Lock,
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  Type,
  RotateCcw,
  Workflow,
  AlertTriangle,
  DollarSign,
  FileSpreadsheet,
  Users,
  LayoutGrid,
  Table,
  Minus,
  CheckCheck,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

// Mirrors backend/src/services/thresholdAlerts.js RULES and HEARTBEAT_GRACE_SECONDS
const ALERT_RULES = [
  { metric: 'CPU', warning: '> 85% for 10 min', critical: '> 95% for 10 min' },
  { metric: 'Memory', warning: '> 85% for 10 min', critical: '> 95% for 5 min' },
  { metric: 'Disk', warning: '> 80%', critical: '> 90%' },
  { metric: 'Heartbeat', warning: '—', critical: 'none for 3 min' },
];

const MUTE_OPTIONS = [
  { label: 'Mute for 1 hour', minutes: 60 },
  { label: 'Mute for 8 hours', minutes: 480 },
  { label: 'Mute until I turn it on', minutes: null },
];

// Platform-wide switch: while muted, alerts are still recorded but no email is sent.
const AlertEmailCard = ({ canManage }) => {
  const { success, error: showError } = useToast();
  const [mute, setMute] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/settings/notifications')
      .then((res) => setMute(res.data.data.emailMute))
      .catch(() => setMute(null));

  useEffect(() => {
    load();
  }, []);

  const update = async (body, message) => {
    setBusy(true);
    try {
      const res = await api.put('/settings/notifications', body);
      setMute(res.data.data.emailMute);
      success(message);
    } catch (err) {
      showError(err.response?.data?.error || 'Could not change alert emails');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Alert Emails</h3>
        {mute && (
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${
              mute.muted
                ? 'bg-amber-50 dark:bg-[#2a1d0b] border-amber-300 dark:border-amber-600/40 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-50 dark:bg-[#0e241b] border-emerald-300 dark:border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {mute.muted ? 'MUTED' : 'ON'}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-[#888888]">
        {mute?.muted
          ? mute.until
            ? `No alert emails until ${new Date(mute.until).toLocaleString()}. Alerts are still recorded on the Alerts page.`
            : 'No alert emails until someone turns them back on. Alerts are still recorded on the Alerts page.'
          : 'Alert and recovery emails are being sent. Muting stops emails only — alerts are still recorded. To silence a single server, edit it and set its status to Maintenance.'}
      </p>
      {canManage ? (
        <div className="flex items-center gap-2 flex-wrap">
          {mute?.muted ? (
            <Button size="sm" disabled={busy} onClick={() => update({ muted: false }, 'Alert emails turned back on')}>
              Turn emails back on
            </Button>
          ) : (
            MUTE_OPTIONS.map((o) => (
              <Button
                key={o.label}
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => update(o.minutes ? { muted: true, minutes: o.minutes } : { muted: true }, `Alert emails: ${o.label.toLowerCase()}`)}
              >
                {o.label}
              </Button>
            ))
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 dark:text-[#888888]">Only a Platform Admin can change this.</p>
      )}
    </div>
  );
};

const ToggleSwitch = ({ checked, onChange, disabled, size = 'md' }) => {
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
        isSm ? 'h-4 w-7' : 'h-5 w-9'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
        checked
          ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
          : 'bg-slate-200 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#333]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isSm
            ? (checked ? 'h-3 w-3 translate-x-3.5 translate-y-0.5' : 'h-3 w-3 translate-x-0.5 translate-y-0.5')
            : (checked ? 'h-4 w-4 translate-x-4 translate-y-0.5' : 'h-4 w-4 translate-x-0.5 translate-y-0.5')
        }`}
      />
    </button>
  );
};

const RBAC_MODULES = [
  {
    key: 'servers',
    label: 'Droplets / Nodes',
    short: 'Servers',
    icon: Server,
    color: 'emerald',
    badge: 'Compute',
    desc: 'Live telemetry, filesystem storage, hardware metrics & node health',
  },
  {
    key: 'terminal',
    label: 'Web Terminal',
    short: 'Terminal',
    icon: TerminalSquare,
    color: 'emerald',
    badge: 'Console',
    desc: 'Interactive remote shell session with bidirectional terminal streaming',
  },
  {
    key: 'operations',
    label: 'Operations & Runbooks',
    short: 'Operations',
    icon: Workflow,
    color: 'purple',
    badge: 'Automation',
    desc: 'Pre-flight playbooks, catalog scripts, and system maintenance jobs',
  },
  {
    key: 'alerts',
    label: 'Alerts & Incidents',
    short: 'Alerts',
    icon: AlertTriangle,
    color: 'amber',
    badge: 'Monitoring',
    desc: 'CPU/Memory/Disk anomaly detection, thresholds & recovery notifications',
  },
  {
    key: 'costs',
    label: 'Costs & Billing',
    short: 'Costs',
    icon: DollarSign,
    color: 'rose',
    badge: 'Finances',
    desc: 'Monthly cloud spend forecasts, resource expenditure & billing breakdowns',
  },
  {
    key: 'auditLogs',
    label: 'Audit Trail',
    short: 'Audit',
    icon: FileSpreadsheet,
    color: 'indigo',
    badge: 'Compliance',
    desc: 'Immutable, tamper-evident security audit events and operator compliance trail',
  },
  {
    key: 'users',
    label: 'User Directory',
    short: 'Users',
    icon: Users,
    color: 'cyan',
    badge: 'Governance',
    desc: 'Operator lifecycle governance, RBAC role assignment & client scopes',
  },
  {
    key: 'settings',
    label: 'Platform Settings',
    short: 'Settings',
    icon: Settings,
    color: 'slate',
    badge: 'System',
    desc: 'Global alert policies, notification mute controls & interface configuration',
  },
];

const ROLES_ORDER = [
  'Platform Admin',
  'DevOps / Infrastructure',
  'Project Admin',
  'Client Admin',
  'Client Viewer',
  'Auditor',
  'Billing / Finance',
];

const ROLES_META = {
  'Platform Admin': {
    scope: 'Global Scope',
    color: 'border-slate-300 dark:border-white/20 text-slate-900 dark:text-white bg-slate-100 dark:bg-white/10',
    desc: 'Unrestricted control plane governance, security policies, and user lifecycle.',
  },
  'DevOps / Infrastructure': {
    scope: 'Assigned Clients',
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    desc: 'Full server provisioning, operation execution, metric diagnostics, and alert remediation.',
  },
  'Project Admin': {
    scope: 'Assigned Clients',
    color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    desc: 'Manage environments, deployment gates, and scoped servers within assigned projects.',
  },
  'Client Admin': {
    scope: 'Single Client Scope',
    color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    desc: 'Manage projects, view billing SLAs, and assign stakeholder permissions.',
  },
  'Client Viewer': {
    scope: 'Read-Only Scoped',
    color: 'border-slate-600 text-slate-300 bg-slate-800',
    desc: 'Read-only telemetry insights, server uptime inspection, and public health visibility.',
  },
  'Auditor': {
    scope: 'Compliance Scope',
    color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    desc: 'Full immutable compliance trail, security event logs, and operational governance inspection.',
  },
  'Billing / Finance': {
    scope: 'Financial Scope',
    color: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
    desc: 'Cost and usage visibility for assigned clients. No operational execution.',
  },
};

const DEFAULT_ROLE_PERMS = {
  'Platform Admin': { servers: true, terminal: true, operations: true, alerts: true, costs: true, auditLogs: true, users: true, settings: true },
  'DevOps / Infrastructure': { servers: true, terminal: true, operations: true, alerts: true, costs: false, auditLogs: true, users: false, settings: false },
  'Project Admin': { servers: true, terminal: false, operations: true, alerts: true, costs: false, auditLogs: false, users: false, settings: false },
  'Client Admin': { servers: true, terminal: false, operations: false, alerts: true, costs: true, auditLogs: false, users: false, settings: false },
  'Client Viewer': { servers: true, terminal: false, operations: false, alerts: true, costs: false, auditLogs: false, users: false, settings: false },
  'Auditor': { servers: true, terminal: false, operations: false, alerts: false, costs: true, auditLogs: true, users: false, settings: false },
  'Billing / Finance': { servers: false, terminal: false, operations: false, alerts: false, costs: true, auditLogs: false, users: false, settings: false },
};

const RolePermissionsMatrixCard = ({ canManage }) => {
  const { success, error: showError } = useToast();
  const [matrix, setMatrix] = useState(DEFAULT_ROLE_PERMS);
  const [initialMatrix, setInitialMatrix] = useState(DEFAULT_ROLE_PERMS);
  const [selectedRole, setSelectedRole] = useState('DevOps / Infrastructure');
  const [viewMode, setViewMode] = useState('studio'); // 'studio' | 'matrix'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMatrix = async () => {
    try {
      const res = await api.get('/settings/roles');
      if (res.data?.success && res.data.data) {
        setMatrix(res.data.data);
        setInitialMatrix(JSON.parse(JSON.stringify(res.data.data)));
      }
    } catch (err) {
      console.error('Failed to load role matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const hasChanges = JSON.stringify(matrix) !== JSON.stringify(initialMatrix);

  const handleToggle = (role, modKey) => {
    if (!canManage) return;
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [modKey]: !prev[role]?.[modKey],
      },
    }));
  };

  const handleBulkRole = (role, grantAll) => {
    if (!canManage) return;
    setMatrix((prev) => {
      const updated = {};
      RBAC_MODULES.forEach((m) => {
        updated[m.key] = grantAll;
      });
      return {
        ...prev,
        [role]: updated,
      };
    });
  };

  const handleResetRole = (role) => {
    if (!canManage) return;
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...DEFAULT_ROLE_PERMS[role] },
    }));
  };

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await api.put('/settings/roles', { matrix });
      if (res.data?.success) {
        setInitialMatrix(JSON.parse(JSON.stringify(res.data.data)));
        setMatrix(res.data.data);
        success('Role permissions saved successfully');
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAllToDefaults = () => {
    if (!canManage) return;
    setMatrix(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)));
  };

  const getActiveCount = (role) => {
    const rolePerms = matrix[role] || DEFAULT_ROLE_PERMS[role] || {};
    return Object.values(rolePerms).filter(Boolean).length;
  };

  const activeRolePerms = matrix[selectedRole] || DEFAULT_ROLE_PERMS[selectedRole] || {};
  const activeRoleCount = getActiveCount(selectedRole);

  return (
    <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-5 shadow-sm">
      {/* Header with Title, View Mode Switch, and Save Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#1f1f1f] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#161616] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-900 dark:text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Role-Based Access Control (RBAC)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${
                    canManage
                      ? 'bg-emerald-50 dark:bg-[#0e241b] border-emerald-300 dark:border-emerald-600/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-[#111111] border-slate-200 dark:border-[#222222] text-slate-500'
                  }`}
                >
                  {canManage ? 'CONFIGURABLE' : 'READ-ONLY'}
                </span>
                {hasChanges && (
                  <span className="px-2 py-0.5 rounded border text-[10px] font-mono font-semibold bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse">
                    UNSAVED EDITS
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
                Default module policies for platform roles. Custom individual overrides in user access take precedence.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
          {/* Segmented View Mode Switch: Policy Studio vs Comparison Matrix */}
          <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#242424]">
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'studio'
                  ? 'bg-white dark:bg-[#202020] text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Policy Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-[#202020] text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Comparison Matrix</span>
            </button>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleResetAllToDefaults}
                  disabled={saving}
                  leftIcon={<RotateCcw className="w-3 h-3" />}
                >
                  Reset Defaults
                </Button>
              )}
              <Button
                size="xs"
                variant={hasChanges ? 'primary' : 'secondary'}
                disabled={!hasChanges || saving}
                isLoading={saving}
                onClick={handleSave}
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
              >
                {hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: POLICY STUDIO (Role Selector Tabs + Clean Module Feature Cards with Micro-Switches) */}
      {viewMode === 'studio' && (
        <div className="space-y-3.5">
          {/* Horizontal Role Selector Bar - No Scrollbar, No 5/8 numbers */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#202020]">
            {ROLES_ORDER.map((role) => {
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-[#888888] hover:text-black dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>

          {/* Active Role Quick Info & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0c0c0c] border border-slate-200 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{selectedRole}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${ROLES_META[selectedRole]?.color}`}>
                {ROLES_META[selectedRole]?.scope}
              </span>
              <span className="text-slate-400 dark:text-[#666] hidden md:inline">•</span>
              <span className="text-slate-500 dark:text-[#888] text-[11px] truncate max-w-md">
                {ROLES_META[selectedRole]?.desc}
              </span>
            </div>

            {canManage && (
              <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => handleBulkRole(selectedRole, true)}
                  className="text-slate-500 hover:text-emerald-500 dark:text-[#888] dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Grant all
                </button>
                <span className="text-slate-300 dark:text-[#333]">|</span>
                <button
                  type="button"
                  onClick={() => handleBulkRole(selectedRole, false)}
                  className="text-slate-500 hover:text-rose-500 dark:text-[#888] dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Revoke all
                </button>
                <span className="text-slate-300 dark:text-[#333]">|</span>
                <button
                  type="button"
                  onClick={() => handleResetRole(selectedRole)}
                  className="text-slate-500 hover:text-black dark:text-[#888] dark:hover:text-white transition-colors cursor-pointer"
                  title="Reset role to default"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* 8 Compact Module Feature Tiles (Streamlined, Clear & Less Bulky) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {RBAC_MODULES.map((m) => {
              const isEnabled = !!activeRolePerms[m.key];
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  onClick={() => {
                    if (canManage) handleToggle(selectedRole, m.key);
                  }}
                  className={`p-3 rounded-xl border transition-all select-none ${
                    canManage ? 'cursor-pointer' : ''
                  } ${
                    isEnabled
                      ? 'bg-slate-50 dark:bg-[#0e0e0e] border-slate-300 dark:border-white/15 hover:border-slate-400 dark:hover:border-white/25 shadow-xs'
                      : 'bg-white dark:bg-[#070707] border-slate-200 dark:border-[#191919] opacity-75 hover:opacity-100 hover:border-slate-300 dark:hover:border-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                          isEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-[#141414] border-slate-200 dark:border-[#222222] text-slate-400 dark:text-zinc-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {m.label}
                      </span>
                    </div>

                    <ToggleSwitch
                      checked={isEnabled}
                      disabled={!canManage}
                      size="sm"
                      onChange={() => handleToggle(selectedRole, m.key)}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-[#888888] leading-snug line-clamp-2">
                    {m.desc}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#171717] flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 dark:text-[#666]">{m.badge}</span>
                    {isEnabled ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        Allowed
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-600">Restricted</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: COMPARISON MATRIX (Refined High-Density Table - No Chunky Blocks) */}
      {viewMode === 'matrix' && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1f1f1f]">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#070707] text-[10px] uppercase font-mono text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
                <tr>
                  <th className="text-left font-semibold p-3.5 pl-4 min-w-[200px]">
                    Platform Role Policy
                  </th>
                  {RBAC_MODULES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <th key={m.key} className="text-center font-medium p-3 whitespace-nowrap min-w-[96px]">
                        <div className="flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200 font-sans font-semibold">
                          <Icon className="w-3.5 h-3.5 opacity-80" />
                          <span>{m.short}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono normal-case tracking-normal">
                          {m.badge}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1a1a] font-sans">
                {ROLES_ORDER.map((role) => {
                  const perms = matrix[role] || DEFAULT_ROLE_PERMS[role];
                  const count = getActiveCount(role);
                  const meta = ROLES_META[role];
                  return (
                    <tr
                      key={role}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">{role}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${meta.color}`}>
                            {meta.scope}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-[#666] mt-0.5">
                          {count} of {RBAC_MODULES.length} modules active
                        </div>
                      </td>

                      {RBAC_MODULES.map((m) => {
                        const isChecked = !!perms?.[m.key];
                        return (
                          <td key={m.key} className="p-2.5 text-center">
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => handleToggle(role, m.key)}
                                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-white/5'
                                }`}
                                title={`Click to toggle ${m.label} for ${role}`}
                              >
                                {isChecked ? (
                                  <>
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Allow</span>
                                  </>
                                ) : (
                                  <>
                                    <Minus className="w-3 h-3" />
                                    <span>Deny</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
                                  isChecked
                                    ? 'text-emerald-500 font-semibold'
                                    : 'text-slate-400 dark:text-zinc-600'
                                }`}
                              >
                                {isChecked ? 'Allow' : 'Deny'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#777] px-1 pt-1 font-mono">
            <span>Click any cell to toggle permissions for that role.</span>
            <span>All updates take effect control-plane wide upon save.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const { success } = useToast();
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700 dark:text-white" />
          Platform Settings &amp; Appearance
        </h1>
      </div>

      {/* 1. APPEARANCE & THEME SECTION */}
      <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1f1f1f] pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-slate-700 dark:text-white" />
              Interface Theme &amp; Typography
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
              Select your visual preference. Active font is <strong className="text-slate-800 dark:text-slate-200">Plus Jakarta Sans</strong> + <strong className="text-slate-800 dark:text-slate-200">JetBrains Mono</strong>.
            </p>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300">
            Active: <strong className="text-slate-900 dark:text-white uppercase">{theme}</strong>
          </span>
        </div>

        {/* 3 Visual Theme Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Dark Mode Card */}
          <div
            onClick={() => {
              setTheme('dark');
              success('Dark mode activated');
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              theme === 'dark'
                ? 'bg-slate-100 dark:bg-[#111111] border-black dark:border-white shadow-md ring-1 ring-black/20 dark:ring-white/30'
                : 'bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-[#1f1f1f] hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#2a2a2a] flex items-center justify-center text-amber-500 dark:text-amber-400">
                    <Moon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Dark Theme</span>
                </div>
                {theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Mini Preview Mockup */}
              <div className="p-2.5 rounded-lg bg-[#000000] border border-[#222222] space-y-1.5 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-2 rounded bg-[#333333]"></span>
                  <span className="w-6 h-2 rounded bg-emerald-500"></span>
                </div>
                <div className="w-full h-3 rounded bg-[#0a0a0a] border border-[#222222]"></div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-[#888888] leading-normal">
                Vercel Geist-inspired monochrome pitch black with high-contrast hairline borders.
              </p>
            </div>
          </div>

          {/* Light Mode Card */}
          <div
            onClick={() => {
              setTheme('light');
              success('Light mode activated');
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              theme === 'light'
                ? 'bg-slate-100 dark:bg-[#111111] border-black dark:border-white shadow-md ring-1 ring-black/20 dark:ring-white/30'
                : 'bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-[#1f1f1f] hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
                    <Sun className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Light Theme</span>
                </div>
                {theme === 'light' && (
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Mini Preview Mockup */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1.5 pointer-events-none shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-2 rounded bg-slate-300"></span>
                  <span className="w-6 h-2 rounded bg-emerald-500"></span>
                </div>
                <div className="w-full h-3 rounded bg-slate-50 border border-slate-200"></div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-[#888888] leading-normal">
                Clean daylight interface with crisp typography and subtle slate borders.
              </p>
            </div>
          </div>

          {/* System Mode Card */}
          <div
            onClick={() => {
              setTheme('system');
              success('System theme preference enabled');
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              theme === 'system'
                ? 'bg-slate-100 dark:bg-[#111111] border-black dark:border-white shadow-md ring-1 ring-black/20 dark:ring-white/30'
                : 'bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-[#1f1f1f] hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#2a2a2a] flex items-center justify-center text-slate-700 dark:text-slate-300">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">System Preference</span>
                </div>
                {theme === 'system' && (
                  <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Mini Preview Mockup */}
              <div className="p-2.5 rounded-lg bg-gradient-to-r from-white to-[#000000] border border-slate-300 dark:border-[#222222] space-y-1.5 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-2 rounded bg-slate-400"></span>
                  <span className="w-6 h-2 rounded bg-slate-500"></span>
                </div>
                <div className="w-full h-3 rounded bg-slate-200/50 dark:bg-[#111111]/50 border border-slate-300 dark:border-[#222222]"></div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-[#888888] leading-normal">
                Automatically match your operating system light / dark mode setting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ROLE PERMISSIONS MATRIX (RBAC) */}
      <RolePermissionsMatrixCard canManage={user?.role === 'Platform Admin'} />

      {/* 3. THRESHOLDS & SPECIFICATIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Thresholds */}
        <div className="md:col-span-2 space-y-6">
          {/* Active alert rules (read-only: these are the rules the backend evaluates) */}
          <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 dark:border-[#1f1f1f] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Alert Rules</h3>
              <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">
                Defaults from the discovery document (§7.5), applied to every server. Per-project rule editing is planned.
              </p>
            </div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase font-mono text-slate-500 dark:text-[#888888]">
                <tr>
                  <th className="text-left font-medium pb-2">Metric</th>
                  <th className="text-left font-medium pb-2">Warning</th>
                  <th className="text-left font-medium pb-2">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f] text-slate-700 dark:text-slate-300 font-mono">
                {ALERT_RULES.map((r) => (
                  <tr key={r.metric}>
                    <td className="py-2 font-sans font-medium">{r.metric}</td>
                    <td className="py-2">{r.warning}</td>
                    <td className="py-2">{r.critical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 dark:text-[#888888]">
              One alert per server and metric (no repeated emails). Alerts close automatically on recovery and send a recovery email.
            </p>
          </div>

          <AlertEmailCard canManage={user?.role === 'Platform Admin'} />

          {/* Agent tokens: issued per server, never shared */}
          <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-2 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Agent Tokens</h3>
            <p className="text-xs text-slate-500 dark:text-[#888888]">
              Every server has its own token; there is no shared secret. To connect a server, open it from Droplets and click{' '}
              <strong className="text-slate-700 dark:text-slate-200">Agent → Generate token</strong>, then run the install command on that server.
              Generating a new token immediately revokes the server's previous one.
            </p>
          </div>
        </div>

        {/* Right 1 Col: Session & Specs */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Operator Session</h3>
            <div className="space-y-2 text-xs">
              <div className="text-slate-500 dark:text-[#888888]">
                User: <strong className="text-slate-900 dark:text-white">{user?.name}</strong>
              </div>
              <div className="text-slate-500 dark:text-[#888888] font-mono">
                {user?.email}
              </div>
              <div className="text-slate-500 dark:text-[#888888]">
                Role: <Badge variant="neutral" size="sm">{user?.role}</Badge>
              </div>
              <div className="text-slate-500 dark:text-[#888888]">
                Status: <Badge variant="healthy" size="sm">{user?.status}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-5 space-y-3 font-mono text-xs shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Platform Specifications</h3>
            <div className="flex justify-between text-slate-500 dark:text-[#888888] border-b border-slate-100 dark:border-[#1f1f1f] pb-1.5">
              <span>Typography:</span>
              <span className="text-slate-900 dark:text-slate-200 font-sans font-medium">Plus Jakarta Sans</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-[#888888] border-b border-slate-100 dark:border-[#1f1f1f] pb-1.5">
              <span>Mono Font:</span>
              <span className="text-slate-900 dark:text-slate-200">JetBrains Mono</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-[#888888] border-b border-slate-100 dark:border-[#1f1f1f] pb-1.5">
              <span>Architecture:</span>
              <span className="text-slate-900 dark:text-slate-200 font-sans font-medium">Phase 1 Control Plane</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-[#888888] border-b border-slate-100 dark:border-[#1f1f1f] pb-1.5">
              <span>Security:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-sans">Enforced (Catalog Only)</strong>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-[#888888]">
              <span>Audit Trail:</span>
              <strong className="text-slate-900 dark:text-white font-sans">100% Immutable</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
