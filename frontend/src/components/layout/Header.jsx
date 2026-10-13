import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  Activity,
  Search,
  Command,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../common/Badge';

export const Header = ({ onOpenMobileMenu, onOpenCommandPalette, activeAlerts = [] }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Generate clean breadcrumb: e.g. "panel > admin" or "panel > servers"
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="h-14 bg-white dark:bg-black/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1f1f1f] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 select-none transition-colors duration-200">
      {/* Left: Mobile Menu Toggle & Path Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-[#888]">
          <span className="text-slate-700 dark:text-slate-300 font-medium">infra</span>
          <span className="text-slate-400 dark:text-[#444] font-sans">/</span>
          {pathSegments.length === 0 ? (
            <span className="text-slate-900 dark:text-white font-medium">dashboard</span>
          ) : (
            pathSegments.map((seg, idx) => {
              const isLast = idx === pathSegments.length - 1;
              const to = '/' + pathSegments.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={to}>
                  {idx > 0 && <span className="text-slate-400 dark:text-[#444] font-sans">/</span>}
                  {isLast ? (
                    <span className="text-slate-900 dark:text-white font-medium">{seg}</span>
                  ) : (
                    <Link to={to} className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      {seg}
                    </Link>
                  )}
                </React.Fragment>
              );
            })
          )}
        </nav>
      </div>

      {/* Middle: Universal Command Palette (Ctrl+K) Trigger & Live Fleet Health */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333] text-xs text-slate-500 dark:text-[#888] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm w-72 justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#666] shrink-0" />
            <span className="font-sans truncate text-[11px]">Search fleet, commands, rules...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-[#888] bg-slate-200 dark:bg-[#141414] rounded border border-slate-300 dark:border-[#262626] shrink-0">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Global Live System Operational Health Pill */}
        <Link
          to="/alerts"
          className={`hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium transition-colors ${
            activeAlerts.length > 0
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeAlerts.length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
            }`}
          />
          <span>
            {activeAlerts.length > 0
              ? `${activeAlerts.length} ${activeAlerts.length === 1 ? 'Incident' : 'Incidents'}`
              : 'Fleet Operational'}
          </span>
        </Link>
      </div>

      {/* Right: Theme Toggle Button + User Initials Badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-[#888] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-md transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* User Badge with Initials */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] hover:border-slate-300 dark:hover:border-[#333] text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-[10px] font-bold flex items-center justify-center">
              {getInitials(user?.name)}
            </span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-[#888] max-w-[150px] truncate">
              {user?.email || ''}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 dark:text-[#666]" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] shadow-2xl z-50 p-1.5 animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-[#1f1f1f]">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-[#888] truncate font-mono">{user?.email}</p>
                <div className="mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 dark:border-[#222] bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888]">
                    {user?.role || 'Platform Admin'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-[#888] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-md transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400 dark:text-[#666]" />
                  Account Settings
                </Link>
                <Link
                  to="/audit-logs"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-[#888] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-md transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-[#666]" />
                  Security &amp; Audit
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-[#212636]">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
