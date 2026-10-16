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

const RBAC_MODULES = [
  { key: 'servers', label: 'Servers', desc: 'Droplets' },
  { key: 'terminal', label: 'Terminal', desc: 'Console' },
  { key: 'operations', label: 'Operations', desc: 'Scripts' },
  { key: 'alerts', label: 'Alerts', desc: 'Incidents' },
  { key: 'costs', label: 'Costs', desc: 'Billing' },
  { key: 'auditLogs', label: 'Audit', desc: 'Logs' },
  { key: 'users', label: 'Users', desc: 'Directory' },
  { key: 'settings', label: 'Settings', desc: 'System' },
];

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

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await api.put('/settings/roles', { matrix });
      if (res.data?.success) {
        setInitialMatrix(JSON.parse(JSON.stringify(res.data.data)));
        setMatrix(res.data.data);
        success('Role permissions matrix saved successfully');
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!canManage) return;
    setMatrix(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)));
  };

  return (
    <div className="rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1f1f1f] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-700 dark:text-white" />
              Role Permissions Matrix (RBAC)
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
          </div>
          <p className="text-xs text-slate-500 dark:text-[#888888] mt-1">
            Configure default module privileges for platform roles. Changes apply to all users with that role (unless individually customized).
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button size="xs" variant="outline" onClick={handleResetToDefaults} disabled={saving} leftIcon={<RotateCcw className="w-3 h-3" />}>
                Reset to Defaults
              </Button>
            )}
            <Button
              size="xs"
              variant="primary"
              disabled={!hasChanges || saving}
              isLoading={saving}
              onClick={handleSave}
            >
              {hasChanges ? 'Save Role Matrix' : 'Saved'}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-[#050505] text-[10px] uppercase font-mono text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
            <tr>
              <th className="text-left font-medium p-3">Platform Role</th>
              {RBAC_MODULES.map((m) => (
                <th key={m.key} className="text-center font-medium p-3 whitespace-nowrap">
                  <div>{m.label}</div>
                  <div className="text-[9px] text-slate-400 font-sans font-normal normal-case">{m.desc}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1f1f1f] text-slate-700 dark:text-slate-300 font-sans">
            {Object.keys(DEFAULT_ROLE_PERMS).map((role) => {
              const perms = matrix[role] || DEFAULT_ROLE_PERMS[role];
              return (
                <tr key={role} className="hover:bg-slate-50/50 dark:hover:bg-[#111111]/50 transition-colors">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {role}
                  </td>
                  {RBAC_MODULES.map((m) => {
                    const isChecked = !!perms?.[m.key];
                    return (
                      <td key={m.key} className="p-3 text-center">
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center w-6 h-6 rounded transition-all ${
                            canManage ? 'cursor-pointer hover:scale-110' : 'cursor-default opacity-80'
                          } ${
                            isChecked
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-black border border-black dark:border-white'
                              : 'bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] text-transparent'
                          }`}
                          onClick={() => {
                            if (!canManage) return;
                            handleToggle(role, m.key);
                          }}
                        >
                          <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!canManage && (
        <p className="text-[11px] text-slate-500 dark:text-[#888888] pt-1">
          Only Platform Admins can edit the role permissions matrix.
        </p>
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
