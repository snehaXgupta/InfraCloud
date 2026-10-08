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
    <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-6 space-y-3 shadow-sm">
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
      <p className="text-xs text-slate-500 dark:text-slate-400">
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
        <p className="text-[11px] text-slate-400">Only a Platform Admin can change this.</p>
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
          <Settings className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          Platform Settings &amp; Appearance
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure appearance mode, typography, telemetry thresholds, and security credentials
        </p>
      </div>

      {/* 1. APPEARANCE & THEME SECTION */}
      <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1c202c] pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Interface Theme &amp; Typography
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your visual preference. Active font is <strong className="text-slate-800 dark:text-slate-200">Plus Jakarta Sans</strong> + <strong className="text-slate-800 dark:text-slate-200">JetBrains Mono</strong>.
            </p>
          </div>

          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-[#131620] border border-slate-200 dark:border-[#212636] text-slate-700 dark:text-slate-300">
            Active: <strong className="text-blue-600 dark:text-blue-400 uppercase">{theme}</strong>
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
                ? 'bg-[#141926] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                : 'bg-slate-50 dark:bg-[#0d0f15] border-slate-200 dark:border-[#212636] hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1e2333] border border-[#2a3147] flex items-center justify-center text-amber-400">
                    <Moon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Dark Theme</span>
                </div>
                {theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Mini Preview Mockup */}
              <div className="p-2.5 rounded-lg bg-[#0a0c10] border border-[#212636] space-y-1.5 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-2 rounded bg-slate-700"></span>
                  <span className="w-6 h-2 rounded bg-emerald-500"></span>
                </div>
                <div className="w-full h-3 rounded bg-[#131620] border border-[#212636]"></div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                DevOps-inspired dark surface with high contrast for continuous monitoring.
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
                ? 'bg-blue-50/70 border-blue-600 shadow-md ring-1 ring-blue-600/50'
                : 'bg-slate-50 dark:bg-[#0d0f15] border-slate-200 dark:border-[#212636] hover:border-slate-400 dark:hover:border-slate-600'
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
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
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

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
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
                ? 'bg-blue-50/70 dark:bg-[#141926] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                : 'bg-slate-50 dark:bg-[#0d0f15] border-slate-200 dark:border-[#212636] hover:border-slate-400 dark:hover:border-slate-600'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#1e2333] border border-slate-300 dark:border-[#2a3147] flex items-center justify-center text-slate-700 dark:text-slate-300">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">System Preference</span>
                </div>
                {theme === 'system' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Mini Preview Mockup */}
              <div className="p-2.5 rounded-lg bg-gradient-to-r from-white to-[#0a0c10] border border-slate-300 dark:border-[#212636] space-y-1.5 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-2 rounded bg-slate-400"></span>
                  <span className="w-6 h-2 rounded bg-blue-500"></span>
                </div>
                <div className="w-full h-3 rounded bg-slate-200/50 dark:bg-[#131620]/50 border border-slate-300 dark:border-[#212636]"></div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Automatically match your operating system light / dark mode setting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THRESHOLDS & SPECIFICATIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Thresholds */}
        <div className="md:col-span-2 space-y-6">
          {/* Active alert rules (read-only: these are the rules the backend evaluates) */}
          <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-6 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 dark:border-[#1c202c] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Alert Rules</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Defaults from the discovery document (§7.5), applied to every server. Per-project rule editing is planned.
              </p>
            </div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase font-mono text-slate-500">
                <tr>
                  <th className="text-left font-medium pb-2">Metric</th>
                  <th className="text-left font-medium pb-2">Warning</th>
                  <th className="text-left font-medium pb-2">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1c202c] text-slate-700 dark:text-slate-300 font-mono">
                {ALERT_RULES.map((r) => (
                  <tr key={r.metric}>
                    <td className="py-2 font-sans font-medium">{r.metric}</td>
                    <td className="py-2">{r.warning}</td>
                    <td className="py-2">{r.critical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              One alert per server and metric (no repeated emails). Alerts close automatically on recovery and send a recovery email.
            </p>
          </div>

          <AlertEmailCard canManage={user?.role === 'Platform Admin'} />

          {/* Agent tokens: issued per server, never shared */}
          <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-6 space-y-2 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Agent Tokens</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every server has its own token; there is no shared secret. To connect a server, open it from Droplets and click{' '}
              <strong className="text-slate-700 dark:text-slate-200">Agent → Generate token</strong>, then run the install command on that server.
              Generating a new token immediately revokes the server's previous one.
            </p>
          </div>
        </div>

        {/* Right 1 Col: Session & Specs */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Operator Session</h3>
            <div className="space-y-2 text-xs">
              <div className="text-slate-500 dark:text-slate-400">
                User: <strong className="text-slate-900 dark:text-white">{user?.name}</strong>
              </div>
              <div className="text-slate-500 dark:text-slate-400 font-mono">
                {user?.email}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Role: <Badge variant="info" size="sm">{user?.role}</Badge>
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Status: <Badge variant="healthy" size="sm">{user?.status}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] p-5 space-y-3 font-mono text-xs shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Platform Specifications</h3>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1c202c] pb-1.5">
              <span>Typography:</span>
              <span className="text-slate-900 dark:text-slate-200 font-sans font-medium">Plus Jakarta Sans</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1c202c] pb-1.5">
              <span>Mono Font:</span>
              <span className="text-slate-900 dark:text-slate-200">JetBrains Mono</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1c202c] pb-1.5">
              <span>Architecture:</span>
              <span className="text-slate-900 dark:text-slate-200 font-sans font-medium">Phase 1 Control Plane</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#1c202c] pb-1.5">
              <span>Security:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-sans">Enforced (Catalog Only)</strong>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Audit Trail:</span>
              <strong className="text-blue-600 dark:text-cyan-400 font-sans">100% Immutable</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
