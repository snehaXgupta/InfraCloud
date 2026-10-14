import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, RefreshCw, Upload, Pencil, Check, X, Table2, BarChart3 } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const COST_MANAGERS = ['Platform Admin', 'Billing / Finance'];

const LABEL_STYLES = {
  Actual: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400',
  Estimated: 'bg-slate-100 dark:bg-[#111111] border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300',
  Mixed: 'bg-slate-100 dark:bg-[#111111] border-slate-200 dark:border-[#222222] text-slate-900 dark:text-white',
  Forecast: 'bg-slate-100 dark:bg-[#111111] border-slate-200 dark:border-[#222222] text-slate-700 dark:text-slate-300',
};

const RATE_SOURCES = {
  'manual-rate': 'Manual rate',
  'plan-catalog': 'Plan price',
  'size-match': 'Size match',
  unpriced: 'Unpriced',
  invoice: 'Invoice',
};

const LabelBadge = ({ label }) =>
  label ? (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold ${LABEL_STYLES[label] || LABEL_STYLES.Estimated}`}>
      {label}
    </span>
  ) : (
    <span className="text-[10px] text-slate-500 dark:text-[#888888]">no data</span>
  );

const recentMonths = (count) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
};

const monthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });

const card = 'rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f]';

const BreakdownTable = ({ title, rows, money, linkTo }) => (
  <div className={`${card} p-4 space-y-3`}>
    <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase font-mono text-slate-500 dark:text-[#888888]">
        <tr>
          <th className="text-left font-medium pb-2">Name</th>
          <th className="text-right font-medium pb-2">Amount</th>
          <th className="text-right font-medium pb-2 pl-2">Basis</th>
          <th className="text-right font-medium pb-2 pl-2">Forecast</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f]">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="py-2 pr-2 text-slate-900 dark:text-slate-200">
              {linkTo && r.id !== 'none' ? <Link className="hover:text-black dark:hover:text-white transition-colors" to={linkTo(r.id)}>{r.name}</Link> : r.name}
              <div className="text-[10px] text-slate-500 dark:text-[#888888]">{r.servers} server{r.servers === 1 ? '' : 's'}</div>
            </td>
            <td className="py-2 text-right font-mono text-slate-900 dark:text-white font-medium">{money(r.amount)}</td>
            <td className="py-2 pl-2 text-right"><LabelBadge label={r.label} /></td>
            <td className="py-2 pl-2 text-right font-mono text-slate-600 dark:text-slate-300">{money(r.forecast)}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={4} className="py-3 text-slate-500 dark:text-[#888888]">No cost data for this month.</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export const CostsPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { success, error: showError } = useToast();
  const canManage = COST_MANAGERS.includes(user?.role);
  const months = useMemo(() => recentMonths(12), []);

  const barColor = isDark ? '#ffffff' : '#09090b';
  const gridColor = isDark ? '#222222' : '#e5e5e5';
  const axisColor = isDark ? '#666666' : '#888888';

  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [editing, setEditing] = useState(null); // { id, value }
  const [importOpen, setImportOpen] = useState(false);
  const [importMonth, setImportMonth] = useState(months[1]);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState(null);

  const load = async () => {
    try {
      const res = await api.get(`/costs/summary?month=${month}`);
      setData(res.data.data);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to load costs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [month]);

  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat([], { style: 'currency', currency: data?.currency || 'USD' });
    return (v) => (v == null ? '—' : fmt.format(v));
  }, [data?.currency]);

  const syncNow = async () => {
    setIsSyncing(true);
    try {
      await api.post('/costs/refresh');
      await load();
      success('Cost data synced');
    } catch (err) {
      showError(err.response?.data?.error || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const saveRate = async (serverId, value) => {
    try {
      const monthlyRate = value === '' ? null : Number(value);
      if (monthlyRate !== null && (!Number.isFinite(monthlyRate) || monthlyRate < 0)) {
        return showError('Enter a non-negative number, or leave empty to use the estimate');
      }
      await api.put(`/costs/servers/${serverId}/rate`, { monthlyRate });
      setEditing(null);
      await load();
      success(monthlyRate === null ? 'Manual rate cleared' : 'Monthly rate saved');
    } catch (err) {
      showError(err.response?.data?.error || 'Could not save rate');
    }
  };

  const submitImport = async (e) => {
    e.preventDefault();
    const lines = importText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^server\s*,/i.test(l))
      .map((l) => {
        const idx = l.lastIndexOf(',');
        return { server: l.slice(0, idx).trim(), amount: Number(l.slice(idx + 1)) };
      });
    if (!lines.length) return showError('Add at least one "server,amount" line');
    try {
      const res = await api.post('/costs/actuals', { month: importMonth, lines });
      setImportResult(res.data.data);
      success(`Imported ${res.data.data.imported} actual cost line(s) for ${importMonth}`);
      if (importMonth === month) load();
    } catch (err) {
      showError(err.response?.data?.error || 'Import failed');
    }
  };

  if (isLoading && !data) return <LoadingSpinner fullPage label="Loading costs..." />;
  if (!data) return null;

  const { totals } = data;
  // Plot every day of the month so bar width stays constant and the month's progress is visible
  const byDate = new Map(data.daily.map((d) => [d.date, d.amount]));
  const dailyRows = Array.from({ length: data.daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { date, day: i + 1, amount: byDate.has(date) ? byDate.get(date) : null };
  });
  const recordedDays = dailyRows.filter((d) => d.amount !== null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-slate-700 dark:text-white" /> Costs
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Billing month"
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-xs text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
          >
            {months.map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
          {canManage && (
            <>
              <Button size="sm" variant="secondary" onClick={syncNow} disabled={isSyncing} leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}>
                Sync now
              </Button>
              <Button size="sm" onClick={() => { setImportResult(null); setImportOpen(true); }} leftIcon={<Upload className="w-3.5 h-3.5" />}>
                Import invoice
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${card} p-4 space-y-2`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#888888]">
            <span>{data.isCurrentMonth ? 'Month to date' : 'Month total'}</span>
            <LabelBadge label={totals.label} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{money(totals.amount)}</div>
          <div className="text-[11px] text-slate-500 dark:text-[#888888]">
            Day {data.daysElapsed} of {data.daysInMonth} · {data.servers.length} servers
          </div>
        </div>
        <div className={`${card} p-4 space-y-2`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#888888]">
            <span>{data.isCurrentMonth ? 'Forecast, end of month' : 'Final'}</span>
            <LabelBadge label={data.isCurrentMonth ? 'Forecast' : totals.label} />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{money(totals.forecast)}</div>
          <div className="text-[11px] text-slate-500 dark:text-[#888888]">
            {data.isCurrentMonth ? 'Month to date + current daily rate × remaining days' : 'Closed month'}
          </div>
        </div>
        <div className={`${card} p-4 space-y-2`}>
          <div className="text-xs text-slate-500 dark:text-[#888888]">Last synced</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : 'Not synced yet'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-[#888888]">
            Currency {data.currency} · billing timezone {data.timezone} · estimates accrue hourly
          </div>
        </div>
      </div>

      {/* Daily accrual */}
      <div className={`${card} p-5 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 dark:text-white">Daily estimated cost · {monthName(month)}</div>
          <button
            onClick={() => setShowDailyTable((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            {showDailyTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {showDailyTable ? 'Show chart' : 'Show as table'}
          </button>
        </div>
        {showDailyTable ? (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f]">
                {recordedDays.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 text-slate-700 dark:text-slate-300 font-mono">{d.date}</td>
                    <td className="py-1.5 text-right text-slate-900 dark:text-white font-mono font-medium">{money(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : recordedDays.length ? (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="day" stroke={axisColor} fontSize={10} tickLine={false} axisLine={{ stroke: gridColor }} interval={1} />
                <YAxis
                  stroke={axisColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => money(v).replace(/\.00$/, '')}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                  content={({ active, payload }) =>
                    active && payload?.length && payload[0].value != null ? (
                      <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] px-3 py-2 rounded-lg shadow-sm text-[11px] font-mono">
                        <div className="text-slate-500 dark:text-[#888888]">{payload[0].payload.date}</div>
                        <div className="text-slate-900 dark:text-white font-bold">{money(payload[0].value)} <span className="text-slate-500 font-normal">estimated</span></div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="amount" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-[#888888]">No estimated cost recorded for this month.</p>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownTable title="By client" rows={data.byClient} money={money} linkTo={(id) => `/clients/${id}`} />
        <BreakdownTable title="By project" rows={data.byProject} money={money} linkTo={(id) => `/projects/${id}`} />
        <BreakdownTable title="By provider" rows={data.byProvider} money={money} />
      </div>

      {/* Servers */}
      <div className={`${card} p-5 space-y-3`}>
        <div className="text-sm font-bold text-slate-900 dark:text-white">Servers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="text-[10px] uppercase font-mono text-slate-500 dark:text-[#888888] border-b border-slate-200 dark:border-[#1f1f1f]">
              <tr>
                <th className="text-left font-medium py-2">Server</th>
                <th className="text-left font-medium py-2">Provider · plan</th>
                <th className="text-right font-medium py-2">Monthly rate</th>
                <th className="text-right font-medium py-2">{data.isCurrentMonth ? 'Month to date' : 'Month total'}</th>
                <th className="text-right font-medium py-2">Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f]">
              {data.servers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-2">
                    <Link to={`/servers/${s.id}`} className="text-slate-900 dark:text-slate-200 hover:text-black dark:hover:text-white font-medium transition-colors">{s.name}</Link>
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-[#888888]">
                    {s.provider} · <span className="font-mono text-slate-700 dark:text-slate-300">{s.instanceType}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    {editing?.id === s.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && saveRate(s.id, editing.value)}
                          placeholder="estimate"
                          aria-label={`Monthly rate for ${s.name}`}
                          className="w-24 px-2 py-1 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] font-mono text-right text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                        />
                        <button onClick={() => saveRate(s.id, editing.value)} className="p-1 text-emerald-500 dark:text-emerald-400 cursor-pointer" title="Save"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className="font-mono text-slate-900 dark:text-white font-medium">{s.monthlyRate == null ? '—' : money(s.monthlyRate)}</span>
                        <span className="text-[10px] text-slate-500 dark:text-[#888888]">{RATE_SOURCES[s.rateSource] || s.rateSource}</span>
                        {canManage && data.isCurrentMonth && (
                          <button
                            onClick={() => setEditing({ id: s.id, value: s.rateSource === 'manual-rate' ? String(s.monthlyRate) : '' })}
                            className="p-1 text-slate-400 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
                            title="Set monthly rate"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-900 dark:text-white font-medium">
                    {money(s.amount)} <span className="ml-1"><LabelBadge label={s.label} /></span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">{money(s.forecast)}</td>
                </tr>
              ))}
              {!data.servers.length && (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500 dark:text-[#888888]">No servers with cost data for this month.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-[#888888]">
          Rate sources: <b>Plan price</b> from the provider price list · <b>Size match</b> nearest plan by vCPU/RAM (rough) ·{' '}
          <b>Manual rate</b> set by Billing · <b>Unpriced</b> no price known.
        </p>
      </div>

      {/* Six-month history */}
      <div className={`${card} p-5 space-y-3`}>
        <div className="text-sm font-bold text-slate-900 dark:text-white">Last 6 months</div>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f]">
            {[...data.history].reverse().map((h) => (
              <tr key={h.month}>
                <td className="py-2 text-slate-700 dark:text-slate-300">{monthName(h.month)}</td>
                <td className="py-2 text-right font-mono text-slate-900 dark:text-white font-medium">{h.label ? money(h.amount) : '—'}</td>
                <td className="py-2 pl-3 w-24 text-right"><LabelBadge label={h.label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice import */}
      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Import invoice actuals" maxWidth="max-w-lg">
        <form onSubmit={submitImport} className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <p className="text-slate-500 dark:text-[#888888]">
            One line per server: <code className="text-slate-900 dark:text-white bg-slate-100 dark:bg-[#1a1a1a] px-1 py-0.5 rounded">server,amount</code>. Server can be its name, hostname or id.
            Actuals replace the estimate for that server and month.
          </p>
          <label className="block">
            <span className="text-slate-600 dark:text-[#888888]">Invoice month</span>
            <select
              value={importMonth}
              onChange={(e) => setImportMonth(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            >
              {months.map((m) => (
                <option key={m} value={m}>{monthName(m)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-600 dark:text-[#888888]">Lines</span>
            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'server,amount\nweb-01.example.com,24.00\nDatabase Primary (PostgreSQL 16),310.50'}
              className="mt-1 w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
            />
          </label>
          {importResult && (
            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0a0a0a] space-y-1">
              <div className="text-emerald-500 dark:text-emerald-400">{importResult.imported} line(s) imported.</div>
              {importResult.unmatched.length > 0 && (
                <div className="text-amber-500 dark:text-amber-400">Not matched to a server: {importResult.unmatched.join(', ')}</div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#1f1f1f]">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button type="submit" leftIcon={<Upload className="w-3.5 h-3.5" />}>Import</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
