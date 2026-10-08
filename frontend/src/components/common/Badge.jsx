import React from 'react';

export const Badge = ({ children, variant = 'neutral', size = 'md', className = '' }) => {
  const variants = {
    healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    offline: 'bg-slate-700/30 text-slate-400 border-slate-700',
    maintenance: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    primary: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variants[variant] || variants.neutral} ${sizes[size] || sizes.md} ${className}`}
    >
      {variant === 'healthy' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
      {variant === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
      {variant === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>}
      {children}
    </span>
  );
};

export const ServerStatusBadge = ({ status }) => {
  const map = {
    healthy: { variant: 'healthy', label: 'Healthy' },
    warning: { variant: 'warning', label: 'Warning' },
    critical: { variant: 'critical', label: 'Critical' },
    offline: { variant: 'offline', label: 'Offline' },
    maintenance: { variant: 'maintenance', label: 'Maintenance' },
  };

  const current = map[status] || { variant: 'neutral', label: status || 'Unknown' };
  return <Badge variant={current.variant}>{current.label}</Badge>;
};

export const SeverityBadge = ({ severity }) => {
  if (severity === 'Critical') {
    return <Badge variant="critical">Critical</Badge>;
  }
  if (severity === 'Warning') {
    return <Badge variant="warning">Warning</Badge>;
  }
  return <Badge variant="neutral">{severity}</Badge>;
};

export const ProviderBadge = ({ provider }) => {
  const providerColors = {
    AWS: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
    GCP: 'text-blue-300 border-blue-500/20 bg-blue-500/5',
    Azure: 'text-sky-300 border-sky-500/20 bg-sky-500/5',
    DigitalOcean: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
    Vultr: 'text-indigo-300 border-indigo-500/20 bg-indigo-500/5',
    Hetzner: 'text-red-300 border-red-500/20 bg-red-500/5',
    'On-Premise': 'text-purple-300 border-purple-500/20 bg-purple-500/5',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-medium border ${providerColors[provider] || 'text-slate-300 border-slate-700 bg-slate-800'}`}
    >
      {provider}
    </span>
  );
};
