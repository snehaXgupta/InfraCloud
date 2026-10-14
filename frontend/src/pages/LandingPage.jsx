import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Server,
  Shield,
  Activity,
  Layers,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Zap,
  Globe,
  Terminal,
  DollarSign,
  Cloud,
  ChevronRight,
  Lock,
  Radio,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { MetricLineChart } from '../components/charts/MetricLineChart';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Compute console URL based on user authentication status
  const consoleUrl = user ? '/dashboard' : '/login';

  // Sample real-time telemetry series
  const sampleTelemetry = [
    { label: '00:00', cpu: 22 },
    { label: '04:00', cpu: 29 },
    { label: '08:00', cpu: 68 },
    { label: '12:00', cpu: 54 },
    { label: '16:00', cpu: 81 },
    { label: '20:00', cpu: 44 },
    { label: '24:00', cpu: 26 },
  ];

  // Best cloud platforms supported
  const cloudPlatforms = [
    {
      name: 'Amazon Web Services',
      short: 'AWS',
      role: 'EC2 · VPC · CloudWatch',
      latency: '< 18ms',
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.84 15.65c-.38.48-.96.76-1.58.76-.84 0-1.62-.51-1.93-1.29l-.24-.61c-.13-.33-.37-.59-.69-.74-.32-.14-.68-.15-1.01-.02l-.58.23c-.76.3-1.6.09-2.14-.51-.39-.44-.55-1.04-.42-1.61.13-.57.54-1.03 1.09-1.23l.6-.23c.31-.12.56-.36.7-.68.14-.32.14-.68.01-1l-.23-.6c-.31-.8-.09-1.7.54-2.26.46-.41 1.07-.58 1.67-.47.6.11 1.11.51 1.37 1.07l.25.55c.14.3.4.52.71.61.31.09.65.04.93-.13l.53-.32c.7-.42 1.58-.33 2.18.22.42.39.63.95.57 1.52-.06.57-.4 1.07-.92 1.34l-.56.29c-.31.16-.52.45-.58.79-.06.34.05.69.29.94l.43.45c.57.6.66 1.49.23 2.18l-.16.29zm-13.68 3.5c4.76 2.5 10.53 2.5 15.29 0 .34-.18.76-.06.94.28.18.34.06.76-.28.94-5.23 2.75-11.57 2.75-16.8 0-.34-.18-.46-.6-.28-.94.18-.34.6-.46.94-.28h.19z" />
        </svg>
      ),
    },
    {
      name: 'Google Cloud (GCP)',
      short: 'GCP',
      role: 'Compute Engine · Cloud Storage',
      latency: '< 14ms',
      icon: (
        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
        </svg>
      ),
    },
    {
      name: 'Microsoft Azure',
      short: 'Azure',
      role: 'Virtual Machines · Blob Storage',
      latency: '< 19ms',
      icon: (
        <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.485 20.306l6.985-16.612h5.53L5.485 20.306zm7.258-2.693l3.033-5.228 3.739 7.921H12.743z" />
        </svg>
      ),
    },
    {
      name: 'DigitalOcean',
      short: 'DigitalOcean',
      role: 'Droplets · Spaces · VPC',
      latency: '< 12ms',
      icon: (
        <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.001 0C5.373 0 0 5.373 0 12.001c0 4.148 2.107 7.808 5.32 9.948v-3.791c-1.89-1.614-3.1-4.004-3.1-6.677 0-4.887 3.96-8.847 8.848-8.847 4.887 0 8.847 3.96 8.847 8.847 0 2.673-1.21 5.063-3.1 6.677v3.791c3.213-2.14 5.32-5.8 5.32-9.948C22.036 5.373 17.629 0 12.001 0z" />
          <path d="M12.001 6.702c-2.927 0-5.299 2.372-5.299 5.299 0 1.621.728 3.073 1.874 4.049v2.274a7.48 7.48 0 01-4.094-6.323c0-4.142 3.358-7.5 7.5-7.5 4.142 0 7.5 3.358 7.5 7.5 0 2.502-1.226 4.717-3.109 6.079v-2.146c1.042-.924 1.709-2.271 1.709-3.774 0-2.927-2.372-5.299-5.299-5.299z" />
          <circle cx="12.001" cy="12.001" r="2.22" />
        </svg>
      ),
    },
    {
      name: 'Hetzner Cloud',
      short: 'Hetzner',
      role: 'Dedicated Baremetal · Cloud VMs',
      latency: '< 16ms',
      icon: (
        <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.5 3h3v7h5V3h3v18h-3v-8h-5v8h-3V3zm16 0h3v18h-3V3z" />
        </svg>
      ),
    },
    {
      name: 'Vultr',
      short: 'Vultr',
      role: 'High-Frequency NVMe · Edge',
      latency: '< 15ms',
      icon: (
        <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 21h4.6L12 9.5 18.4 21H23L12 2zm0 11.5L9.5 18h5L12 13.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 selection:bg-white/20 selection:text-white font-sans antialiased relative">
      {/* =========================================================================
          FIXED CENTER RADIANT SPOTLIGHT GRADIENT
          - Stays permanently locked in the center of the viewport as user scrolls
          ========================================================================= */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      >
        {/* Layer 1: Wide Center Radiant Spotlight Glow (Anchored in screen center) */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1050px] h-[520px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.035) 40%, rgba(56, 189, 248, 0.02) 60%, transparent 75%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Layer 2: Concentrated Radiant Core Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[680px] h-[300px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 80%)',
            filter: 'blur(24px)',
          }}
        />

        {/* Layer 3: Architectural Blueprint Grid illuminated in the center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle, rgba(255, 255, 255, 0.5) 1.2px, transparent 1.2px),
              linear-gradient(to right, rgba(255, 255, 255, 0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            maskImage:
              'radial-gradient(ellipse 700px 450px at 50% 50%, black 20%, rgba(0, 0, 0, 0.5) 55%, transparent 85%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 700px 450px at 50% 50%, black 20%, rgba(0, 0, 0, 0.5) 55%, transparent 85%)',
          }}
        />

        {/* Layer 4: Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[220px] bg-white/[0.04] blur-3xl pointer-events-none" />
      </div>

      {/* =========================================================================
          1. TOP NAVIGATION
          ========================================================================= */}
      <header className="h-16 border-b border-[#1f1f1f] bg-[#000000]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-xs shadow-sm">
              <Server className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">InfraCloud</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#111111] border border-[#222222] text-zinc-400">
                v2.4
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login">
              <button className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer">
                Sign In
              </button>
            </Link>
            <Link to="/login?mode=register">
              <button className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white border border-[#262626] hover:border-[#383838] bg-[#0c0c0c] transition-colors cursor-pointer hidden sm:inline-flex">
                Register
              </button>
            </Link>
            <Link to={consoleUrl}>
              <button className="px-3.5 py-1.5 rounded-md bg-white text-black hover:bg-[#eaeaea] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm">
                <span>Launch Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION (PROFESSIONAL, ARCHITECTURAL, CLEAN)
          ========================================================================= */}
      <section className="relative z-10 pt-24 pb-20 overflow-hidden border-b border-[#1f1f1f]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          {/* Status Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0a0a0a] border border-[#222222] text-zinc-300 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Unified Multi-Cloud Control Plane</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.1] max-w-3xl mx-auto">
            Control every droplet, instance and cluster in one place
          </h1>

          {/* Human, purposeful explanation */}
          <p className="mt-6 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Manage instances, monitor live telemetry, and execute audited infrastructure operations across AWS, GCP, Azure, and DigitalOcean in one workspace.
          </p>

          {/* Action buttons */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={consoleUrl} className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-white text-black hover:bg-[#eaeaea] text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm">
                <span>Launch Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login?mode=register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-[#0a0a0a] border border-[#222222] hover:bg-[#141414] text-sm font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer">
                Register New User
              </button>
            </Link>
          </div>

          {/* Key Executive Metrics */}
          <div className="mt-14 pt-10 border-t border-[#1a1a1a] grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">TELEMETRY LATENCY</span>
              <p className="text-xl font-bold text-white mt-1 font-mono">&lt; 15s Pulse</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Prometheus remote_write</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">CHANGE GOVERNANCE</span>
              <p className="text-xl font-bold text-white mt-1 font-mono">2-Person</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Peer-approved operations</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">AUDIT TRAIL</span>
              <p className="text-xl font-bold text-white mt-1 font-mono">100% Immutable</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Cryptographic log stream</p>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">PLATFORM AVAILABILITY</span>
              <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">99.98% SLA</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Automated heartbeat monitor</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. CLOUD PLATFORMS SECTION
          ========================================================================= */}
      <section className="relative z-10 py-14 border-b border-[#1f1f1f] bg-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-8">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Supported Infrastructure Ecosystem
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Native telemetry collector and operation integration across standard cloud hosts
              </p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 self-start sm:self-auto">
              Standardized Host Daemons
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cloudPlatforms.map((p) => (
              <div
                key={p.name}
                className="p-4 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                    {p.icon}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">{p.latency}</span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white tracking-tight">{p.short}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1 line-clamp-1">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. EXACTLY 3 SUBTLE FEATURE CARDS (CLEAN, SOPHISTICATED, PURPOSEFUL)
          ========================================================================= */}
      <section className="relative z-10 py-20 border-b border-[#1f1f1f] bg-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Core platform capabilities
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400">
              Three architectural pillars engineered for infrastructure stability and governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* PILLAR 1: FLEET OBSERVABILITY */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 01</span>
                <h3 className="text-base font-bold text-white mt-1">Autonomous Host Telemetry</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Real host metrics streamed via Prometheus remote-write every 15 seconds. If a node breaches defined thresholds, the system flags active violations and triggers automated runbooks.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Host Ingestion
                </span>
                <span>Prometheus</span>
              </div>
            </div>

            {/* PILLAR 2: TWO-PERSON GOVERNED OPERATIONS */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 02</span>
                <h3 className="text-base font-bold text-white mt-1">Two-Person Governed Operations</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Eliminates rogue shell scripts. High-impact tasks like resizing nodes, service restarts, failovers, and cache purges require an independent peer approval before execution.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="text-zinc-300">Peer Sign-Off</span>
                <span className="text-zinc-400 font-semibold">RBAC Audited</span>
              </div>
            </div>

            {/* PILLAR 3: MULTITENANCY & COST ACCRUAL */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 03</span>
                <h3 className="text-base font-bold text-white mt-1">Multitenant Cost Accounting</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Isolate infrastructure cleanly by Client Organization → Project → Droplet. Accrue hourly runtime rates and automatically reconcile monthly invoices against real telemetry.
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#1a1a1a] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="text-zinc-300">Invoice Reconciliation</span>
                <span className="text-emerald-400 font-semibold">Hourly Accrual</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. LIVE METRICS PREVIEW CANOPY
          ========================================================================= */}
      <section className="relative z-10 py-16 border-b border-[#1f1f1f] bg-transparent">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden shadow-2xl">
            {/* Terminal Top Bar */}
            <div className="h-10 border-b border-[#1f1f1f] px-4 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="text-zinc-300 font-medium">live-cluster-telemetry.prometheus</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ACTIVE PROBE</span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Cluster Compute Saturation</h4>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Aggregated CPU usage across all registered nodes</p>
                </div>
                <span className="text-xs font-mono text-zinc-300 font-bold px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800">
                  Peak: 81.0%
                </span>
              </div>
              <MetricLineChart data={sampleTelemetry} metricKey="cpu" metricName="CPU Load" height={180} />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. BOTTOM CALL TO ACTION
          ========================================================================= */}
      <section className="relative z-10 py-20 border-b border-[#1f1f1f] bg-transparent text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Ready to inspect your infrastructure?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400">
            Sign in to access your scoped servers, projects, and active alerts.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to={consoleUrl}>
              <button className="px-6 py-2.5 rounded-md bg-white text-black hover:bg-[#eaeaea] text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                <span>Launch Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FOOTER (INCLUDES: "InfraCloud by Simpel TechLabs Pvt. Ltd.")
          ========================================================================= */}
      <footer className="bg-[#000000] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-white" />
            <span className="text-white font-semibold">InfraCloud</span>
            <span>by</span>
            <span className="text-zinc-300 font-medium">Simpel TechLabs Pvt. Ltd.</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span>All Systems Operational</span>
            <span className="text-zinc-700">·</span>
            <span>Enterprise SLA 99.99%</span>
          </div>

          <div>
            © {new Date().getFullYear()} Simpel TechLabs Pvt. Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
