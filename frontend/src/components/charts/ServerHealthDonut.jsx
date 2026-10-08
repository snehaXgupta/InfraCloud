import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export const ServerHealthDonut = ({ health = {}, height = 180 }) => {
  const data = [
    { name: 'Healthy', value: health.healthy || 0, color: '#10b981' },
    { name: 'Warning', value: health.warning || 0, color: '#f59e0b' },
    { name: 'Critical', value: health.critical || 0, color: '#ef4444' },
    { name: 'Offline', value: health.offline || 0, color: '#64748b' },
  ].filter((d) => d.value > 0);

  const total = (health.healthy || 0) + (health.warning || 0) + (health.critical || 0) + (health.offline || 0);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: 'No Data', value: 1, color: '#1e293b' }]}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {(data.length ? data : [{ color: '#1e293b' }]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg shadow-xl text-xs">
                      <span className="font-semibold text-white">{payload[0].name}:</span>{' '}
                      <span className="text-slate-300">{payload[0].value} servers</span>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center Health Score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
        <span className="text-2xl font-bold text-white tracking-tight">{health.healthScore || 100}%</span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Health Index</span>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300">Healthy ({health.healthy || 0})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-slate-300">Warning ({health.warning || 0})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          <span className="text-slate-300">Critical ({health.critical || 0})</span>
        </div>
      </div>
    </div>
  );
};
