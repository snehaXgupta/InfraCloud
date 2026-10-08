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

export const MetricLineChart = ({
  data = [],
  metricKey = 'cpu',
  metricName = 'CPU Usage',
  color = '#3b82f6',
  unit = '%',
  domain = [0, 100],
  height = 220,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-xs text-slate-500 bg-slate-900/30 rounded-lg border border-slate-800">
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
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
          />
          <YAxis
            stroke="#64748b"
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
                  <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-[11px] text-slate-400 font-mono mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="text-xs font-semibold text-white">
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
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const NetworkTrafficChart = ({ data = [], height = 220 }) => {
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
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl backdrop-blur-md space-y-1">
                    <p className="text-[11px] text-slate-400 font-mono mb-1">{label}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span className="text-slate-200">Ingress: <strong className="text-white">{payload[0]?.value} Mbps</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span className="text-slate-200">Egress: <strong className="text-white">{payload[1]?.value} Mbps</strong></span>
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
