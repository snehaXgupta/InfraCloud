import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';

export const MetricLineChart = ({
  data = [],
  metricKey = 'cpu',
  metricName = 'CPU Usage',
  color,
  unit = '%',
  domain = [0, 100],
  height = 220,
}) => {
  const { isDark } = useTheme();
  const finalColor = color || (isDark ? '#ffffff' : '#09090b');
  const gridColor = isDark ? '#222222' : '#e5e5e5';
  const axisColor = isDark ? '#666666' : '#888888';

  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-black rounded-lg border border-slate-200 dark:border-[#222222]">
        No metric telemetry available for selected window
      </div>
    );
  }

  const gradientId = `gradient-${metricKey}`;

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={finalColor} stopOpacity={isDark ? 0.35 : 0.2} />
              <stop offset="95%" stopColor={finalColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
          />
          <YAxis
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={domain}
            tickFormatter={(val) => `${val}${unit}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-2.5 rounded-lg shadow-md">
                    <p className="text-[11px] text-slate-500 dark:text-[#888888] font-mono mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: finalColor }}></span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {metricName}: {payload[0].value} {unit}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey={metricKey}
            stroke={finalColor}
            strokeWidth={1.75}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const NetworkTrafficChart = ({ data = [], height = 220 }) => {
  const { isDark } = useTheme();
  const gridColor = isDark ? '#222222' : '#e5e5e5';
  const axisColor = isDark ? '#666666' : '#888888';

  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="netInGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="netOutGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" stroke={axisColor} fontSize={11} tickLine={false} axisLine={{ stroke: gridColor }} />
          <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#222222] p-2.5 rounded-lg shadow-md space-y-1">
                    <p className="text-[11px] text-slate-500 dark:text-[#888888] font-mono mb-1">{label}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span className="text-slate-600 dark:text-slate-200">Ingress: <strong className="text-slate-900 dark:text-white">{payload[0]?.value} Mbps</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span className="text-slate-600 dark:text-slate-200">Egress: <strong className="text-slate-900 dark:text-white">{payload[1]?.value} Mbps</strong></span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area type="monotone" dataKey="networkIn" name="Ingress" stroke="#06b6d4" strokeWidth={2} fill="url(#netInGradient)" />
          <Area type="monotone" dataKey="networkOut" name="Egress" stroke="#8b5cf6" strokeWidth={2} fill="url(#netOutGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
