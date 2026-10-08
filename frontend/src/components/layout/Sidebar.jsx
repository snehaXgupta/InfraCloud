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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeAlertsCount = 0, isMobile = false, onCloseMobile }) => {
  const { user } = useAuth();

  // `roles` hides links a role can't use (the API enforces the same rules)
  const ADMIN = 'Platform Admin';
  const DEVOPS = 'DevOps / Infrastructure';
  const navigation = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Spaces', to: '/clients', icon: Database },
    { name: 'Droplets', to: '/servers', icon: Server },
    { name: 'Projects', to: '/projects', icon: FolderGit2 },
    { name: 'Users', to: '/users', icon: Users, roles: [ADMIN] },
    { name: 'Operations', to: '/operations', icon: Workflow, roles: [ADMIN, DEVOPS, 'Project Admin', 'Client Admin', 'Auditor'] },
    { name: 'Resize Requests', to: '/resize-requests', icon: Sliders },
    { name: 'Costs', to: '/costs', icon: DollarSign },
    { name: 'Integrations', to: '/integrations', icon: Plug, roles: [ADMIN, DEVOPS] },
    { name: 'Audit Logs', to: '/audit-logs', icon: FileSpreadsheet, roles: [ADMIN, 'Auditor'] },
    {
      name: 'Alerts',
      to: '/alerts',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-[#0a0c10] border-r border-slate-200 dark:border-[#1c202c] select-none transition-colors duration-200 ${
        isMobile ? 'w-64' : 'w-60 shrink-0'
      }`}
    >
      {/* Brand Header matching Screenshot: SPACES PANEL */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 dark:border-[#1c202c] gap-3">
        <div className="w-7 h-7 rounded bg-[#2563eb] flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
          <LayoutGrid className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black tracking-wider text-slate-900 dark:text-white uppercase font-sans">
            SPACES PANEL
          </span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {navigation.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            onClick={isMobile ? onCloseMobile : undefined}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 dark:bg-[#18243c] text-blue-600 dark:text-blue-400 font-semibold shadow-inner'
                  : 'text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131620]'
              }`
            }
          >
            <div className="flex items-center gap-2.5">
              <item.icon className="w-4 h-4 shrink-0 opacity-85" />
              <span>{item.name}</span>
            </div>

            {item.badge && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Admin session status in bottom left */}
      <div className="p-3 border-t border-slate-200 dark:border-[#1c202c]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] text-[11px] text-slate-600 dark:text-[#94a3b8]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Admin session</span>
        </div>
      </div>
    </aside>
  );
};
