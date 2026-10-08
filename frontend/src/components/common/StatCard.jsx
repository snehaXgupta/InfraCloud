import React from 'react';
import { Card } from './Card';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  className = '',
  onClick,
}) => {
  const iconColors = {
    default: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };

  const borderAccent = {
    default: 'hover:border-blue-500/40',
    healthy: 'hover:border-emerald-500/40',
    warning: 'hover:border-amber-500/40',
    critical: 'hover:border-rose-500/40',
    purple: 'hover:border-purple-500/40',
    cyan: 'hover:border-cyan-500/40',
  };

  return (
    <Card
      onClick={onClick}
      className={`p-5 relative overflow-hidden group transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${borderAccent[variant]} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h4 className="text-2xl font-bold tracking-tight text-white">{value}</h4>
            {trend && (
              <span className={`text-xs font-medium ${trend.isPositive ? 'text-emerald-400' : 'text-slate-400'}`}>
                {trend.text}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>

        {Icon && (
          <div className={`p-2.5 rounded-lg border ${iconColors[variant]} group-hover:scale-105 transition-transform`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Subtle indicator bottom line */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-[2px] opacity-20 group-hover:opacity-100 transition-opacity ${
          variant === 'healthy'
            ? 'bg-emerald-500'
            : variant === 'warning'
            ? 'bg-amber-500'
            : variant === 'critical'
            ? 'bg-rose-500'
            : 'bg-blue-500'
        }`}
      />
    </Card>
  );
};
