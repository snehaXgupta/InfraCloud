import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Database,
  Users,
  FolderGit2,
  Workflow,
  Copy,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  LayoutGrid,
  DollarSign,
  Sliders,
  Plug,
  GitBranch,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeAlertsCount = 0, isMobile = false, onCloseMobile }) => {
  const { user } = useAuth();

  // `roles` hides links a role can't use (the API enforces the same rules)
  const ADMIN = 'Platform Admin';
  const DEVOPS = 'DevOps / Infrastructure';
  const navigation = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Spaces', to: '/clients', icon: Database, module: 'servers' },
    { name: 'Droplets', to: '/servers', icon: Server, module: 'servers' },
    { name: 'Projects', to: '/projects', icon: FolderGit2, module: 'servers' },
    { name: 'Users', to: '/users', icon: Users, roles: [ADMIN], module: 'users' },
    { name: 'Operations', to: '/operations', icon: Workflow, roles: [ADMIN, DEVOPS, 'Project Admin', 'Client Admin', 'Auditor'], module: 'operations' },
    { name: 'Replication', to: '/replication', icon: GitBranch, module: 'operations' },
    { name: 'Resize Requests', to: '/resize-requests', icon: Sliders, module: 'operations' },
    { name: 'Costs', to: '/costs', icon: DollarSign, module: 'costs' },
    { name: 'Integrations', to: '/integrations', icon: Plug, roles: [ADMIN, DEVOPS], module: 'settings' },
    { name: 'Audit Logs', to: '/audit-logs', icon: FileSpreadsheet, roles: [ADMIN, 'Auditor'], module: 'auditLogs' },
    {
      name: 'Alerts',
      to: '/alerts',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
      module: 'alerts',
    },
    { name: 'Settings', to: '/settings', icon: Settings, module: 'settings' },
  ];

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-black border-r border-slate-200 dark:border-[#1f1f1f] select-none transition-colors duration-200 ${
        isMobile ? 'w-64' : 'w-60 shrink-0'
      }`}
    >
      {/* Brand Header with Vercel Mark: SPACES PANEL */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 dark:border-[#1f1f1f] gap-3">
        <div className="w-6 h-6 rounded flex items-center justify-center text-white bg-black border border-slate-300 dark:border-[#2e2e2e] shadow-sm">
          <svg viewBox="0 0 76 65" fill="currentColor" className="w-3.5 h-3.5 text-slate-900 dark:text-white">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            SPACES PANEL
          </span>
          <span className="px-1.5 py-0.2 text-[9px] font-mono rounded border border-slate-300 dark:border-[#333] text-slate-500 dark:text-[#888] bg-slate-100 dark:bg-[#111]">
            PRO
          </span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navigation.filter((item) => {
          if (user?.role === ADMIN && !user?.customPermissions?.[item.module]) return true;
          if (user?.effectivePermissions && item.module) {
            if (user.effectivePermissions[item.module] === false) return false;
            if (user.effectivePermissions[item.module] === true && !item.roles) return true;
          }
          if (item.roles && !item.roles.includes(user?.role)) {
            if (item.module && user?.effectivePermissions?.[item.module] === true) return true;
            return false;
          }
          return true;
        }).map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            onClick={isMobile ? onCloseMobile : undefined}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium'
                  : 'text-slate-600 dark:text-[#888888] hover:text-slate-900 dark:hover:text-[#ededed] hover:bg-slate-100 dark:hover:bg-white/[0.04]'
              }`
            }
          >
            <div className="flex items-center gap-2.5">
              <item.icon className="w-4 h-4 shrink-0 opacity-80" />
              <span>{item.name}</span>
            </div>

            {item.badge && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Admin session status in bottom left */}
      <div className="p-3 border-t border-slate-200 dark:border-[#1f1f1f]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] text-[11px] text-slate-600 dark:text-[#888888]">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Admin session</span>
        </div>
      </div>
    </aside>
  );
};
