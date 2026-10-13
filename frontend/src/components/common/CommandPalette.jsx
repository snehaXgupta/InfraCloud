import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Server,
  Database,
  AlertTriangle,
  Workflow,
  DollarSign,
  Settings,
  ShieldCheck,
  Radio,
  Terminal,
  Activity,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  XCircle,
  Bell,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

export const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [servers, setServers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  // Fetch servers and clients on mount for quick search indexing
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      Promise.all([
        api.get('/servers').catch(() => ({ data: { data: [] } })),
        api.get('/clients').catch(() => ({ data: { data: [] } })),
      ]).then(([serversRes, clientsRes]) => {
        setServers(serversRes.data?.data || []);
        setClients(clientsRes.data?.data || []);
        setIsLoading(false);
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build command palette search items
  const navigationItems = [
    { id: 'nav-dash', title: 'Dashboard', subtitle: 'Overview & fleet health telemetry', icon: Activity, category: 'Navigation', action: () => navigate('/dashboard') },
    { id: 'nav-servers', title: 'Droplets & Servers', subtitle: 'Manage fleet compute, memory & specs', icon: Server, category: 'Navigation', action: () => navigate('/servers') },
    { id: 'nav-alerts', title: 'Infrastructure Alerts', subtitle: 'Incident rules & live threshold monitor', icon: AlertTriangle, category: 'Navigation', action: () => navigate('/alerts') },
    { id: 'nav-spaces', title: 'Spaces & Clients', subtitle: 'Multi-tenant organizations & scopes', icon: Database, category: 'Navigation', action: () => navigate('/clients') },
    { id: 'nav-ops', title: 'Controlled Operations', subtitle: 'Restart, sync, and fleet jobs catalog', icon: Workflow, category: 'Navigation', action: () => navigate('/operations') },
    { id: 'nav-costs', title: 'Costs & Cloud Ingestion', subtitle: 'Fleet hourly cost & sizing analysis', icon: DollarSign, category: 'Navigation', action: () => navigate('/costs') },
    { id: 'nav-audit', title: 'Security Audit Logs', subtitle: 'Immutable compliance trail', icon: ShieldCheck, category: 'Navigation', action: () => navigate('/audit-logs') },
    { id: 'nav-settings', title: 'Control Plane Settings', subtitle: 'Email alerts & threshold policies', icon: Settings, category: 'Navigation', action: () => navigate('/settings') },
  ];

  const quickActionItems = [
    {
      id: 'act-sim-crit',
      title: 'Simulate Critical Incident',
      subtitle: 'Trigger Memory saturation breach & email alert',
      icon: XCircle,
      category: 'DevOps Actions',
      badge: 'Test Incident',
      action: async () => {
        try {
          await api.post('/alerts/simulate', { type: 'critical' });
          navigate('/alerts');
        } catch (e) {}
      },
    },
    {
      id: 'act-sim-warn',
      title: 'Simulate High CPU Warning',
      subtitle: 'Trigger CPU warning rule (>85% limit)',
      icon: Bell,
      category: 'DevOps Actions',
      badge: 'Test Incident',
      action: async () => {
        try {
          await api.post('/alerts/simulate', { type: 'warning' });
          navigate('/alerts');
        } catch (e) {}
      },
    },
    {
      id: 'act-sim-down',
      title: 'Simulate Server Down (Heartbeat Lost)',
      subtitle: 'Raise critical missing heartbeat alert',
      icon: Radio,
      category: 'DevOps Actions',
      badge: 'Test Incident',
      action: async () => {
        try {
          await api.post('/alerts/simulate', { type: 'server-down' });
          navigate('/alerts');
        } catch (e) {}
      },
    },
  ];

  const serverItems = servers.map((s) => ({
    id: `srv-${s._id}`,
    title: s.name,
    subtitle: `${s.network?.publicIp || '127.0.0.1'} · ${s.provider} (${s.region}) · ${s.serverRole || 'Application Node'}`,
    icon: Server,
    category: 'Droplets & Compute Nodes',
    badge: s.status,
    action: () => navigate(`/servers/${s._id}`),
  }));

  const clientItems = clients.map((c) => ({
    id: `cli-${c._id}`,
    title: c.name,
    subtitle: `${c.tier || 'Enterprise'} tier · ${c.contactEmail || ''}`,
    icon: Database,
    category: 'Spaces & Organizations',
    action: () => navigate(`/clients/${c._id}`),
  }));

  const allItems = [...quickActionItems, ...navigationItems, ...serverItems, ...clientItems];

  const filteredItems = query.trim() === ''
    ? allItems.slice(0, 10)
    : allItems.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-xl bg-[#0a0a0a] border border-[#222222] shadow-2xl shadow-black/90 overflow-hidden text-slate-100 flex flex-col max-h-[80vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-[#1f1f1f] bg-black">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search droplets, spaces, telemetry, or dispatch actions..."
            className="w-full bg-transparent border-0 text-sm font-sans placeholder-[#666] text-white focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-[#141414] border border-[#262626] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No matching droplets, spaces, or actions found for "{query}"</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white/[0.08] border border-white/10 text-white'
                      : 'hover:bg-white/[0.03] border border-transparent text-[#aaa]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                        isSelected ? 'bg-white text-black border-white' : 'bg-[#141414] text-slate-400 border-[#222]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate font-sans">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          item.badge === 'healthy' || item.badge === 'online'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : item.badge.includes('Test')
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#1c2234] bg-[#0a0d14] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#131826] border border-[#232c44] text-[10px] text-slate-300">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#131826] border border-[#232c44] text-[10px] text-slate-300">↵</kbd> select
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>InfraControl Command Plane</span>
          </div>
        </div>
      </div>
    </div>
  );
};
