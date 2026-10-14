import React, { useState, useEffect } from 'react';
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
  FileCheck,
  DollarSign,
  Cloud,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { MetricLineChart } from '../components/charts/MetricLineChart';
import { useAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrollProgress, setScrollProgress] = useState(0);

  // Compute console URL based on authentication status
  const consoleUrl = user ? '/dashboard' : '/login';

  // Dynamic depth tracking for the right-margin mountain elevation meter
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const depthElevation = Math.round(scrollProgress * 4800);

  // Sample real-time telemetry series
  const sampleTelemetry = [
    { label: '00:00', cpu: 24 },
    { label: '04:00', cpu: 31 },
    { label: '08:00', cpu: 72 },
    { label: '12:00', cpu: 58 },
    { label: '16:00', cpu: 84 },
    { label: '20:00', cpu: 46 },
    { label: '24:00', cpu: 29 },
  ];

  // Best cloud platforms supported
  const cloudPlatforms = [
    {
      name: 'DigitalOcean',
      tagline: 'Native Droplets & Spaces',
      badge: 'Tier 1 Partner',
      icon: (
        <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.001 0C5.373 0 0 5.373 0 12.001c0 4.148 2.107 7.808 5.32 9.948v-3.791c-1.89-1.614-3.1-4.004-3.1-6.677 0-4.887 3.96-8.847 8.848-8.847 4.887 0 8.847 3.96 8.847 8.847 0 2.673-1.21 5.063-3.1 6.677v3.791c3.213-2.14 5.32-5.8 5.32-9.948C22.036 5.373 17.629 0 12.001 0z" />
          <path d="M12.001 6.702c-2.927 0-5.299 2.372-5.299 5.299 0 1.621.728 3.073 1.874 4.049v2.274a7.48 7.48 0 01-4.094-6.323c0-4.142 3.358-7.5 7.5-7.5 4.142 0 7.5 3.358 7.5 7.5 0 2.502-1.226 4.717-3.109 6.079v-2.146c1.042-.924 1.709-2.271 1.709-3.774 0-2.927-2.372-5.299-5.299-5.299z" />
          <circle cx="12.001" cy="12.001" r="2.22" />
        </svg>
      ),
    },
    {
      name: 'Amazon Web Services',
      tagline: 'EC2, VPC & CloudWatch',
      badge: 'Enterprise',
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.84 15.65c-.38.48-.96.76-1.58.76-.84 0-1.62-.51-1.93-1.29l-.24-.61c-.13-.33-.37-.59-.69-.74-.32-.14-.68-.15-1.01-.02l-.58.23c-.76.3-1.6.09-2.14-.51-.39-.44-.55-1.04-.42-1.61.13-.57.54-1.03 1.09-1.23l.6-.23c.31-.12.56-.36.7-.68.14-.32.14-.68.01-1l-.23-.6c-.31-.8-.09-1.7.54-2.26.46-.41 1.07-.58 1.67-.47.6.11 1.11.51 1.37 1.07l.25.55c.14.3.4.52.71.61.31.09.65.04.93-.13l.53-.32c.7-.42 1.58-.33 2.18.22.42.39.63.95.57 1.52-.06.57-.4 1.07-.92 1.34l-.56.29c-.31.16-.52.45-.58.79-.06.34.05.69.29.94l.43.45c.57.6.66 1.49.23 2.18l-.16.29zm-13.68 3.5c4.76 2.5 10.53 2.5 15.29 0 .34-.18.76-.06.94.28.18.34.06.76-.28.94-5.23 2.75-11.57 2.75-16.8 0-.34-.18-.46-.6-.28-.94.18-.34.6-.46.94-.28h.19z" />
        </svg>
      ),
    },
    {
      name: 'Google Cloud (GCP)',
      tagline: 'Compute Engine & vmagent',
      badge: 'High Performance',
      icon: (
        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
        </svg>
      ),
    },
    {
      name: 'Microsoft Azure',
      tagline: 'Virtual Machines & Blobs',
      badge: 'Multi-Region',
      icon: (
        <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.485 20.306l6.985-16.612h5.53L5.485 20.306zm7.258-2.693l3.033-5.228 3.739 7.921H12.743z" />
        </svg>
      ),
    },
    {
      name: 'Hetzner Cloud',
      tagline: 'Baremetal & Dedicated VMs',
      badge: 'European Leader',
      icon: (
        <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.5 3h3v7h5V3h3v18h-3v-8h-5v8h-3V3zm16 0h3v18h-3V3z" />
        </svg>
      ),
    },
    {
      name: 'Vultr',
      tagline: 'High-Frequency NVMe',
      badge: 'Low Latency',
      icon: (
        <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 21h4.6L12 9.5 18.4 21H23L12 2zm0 11.5L9.5 18h5L12 13.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-white/20 selection:text-white relative overflow-x-hidden font-sans">
      {/* =========================================================================
          RIGHT MARGIN: DIGITALOCEAN-INSPIRED SCROLL DEPTH METER
          ========================================================================= */}
      <div className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-50 hidden sm:flex flex-col items-center pointer-events-none select-none">
        <span className="font-mono text-[9px] text-zinc-500 tracking-widest -rotate-90 origin-center mb-7 whitespace-nowrap">
          ELEVATION // {depthElevation.toLocaleString()}M
        </span>
        <div className="relative w-1 h-44 bg-zinc-900 border border-zinc-800 rounded-full flex flex-col justify-between py-1">
          {/* Elevation tick marks */}
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <div key={t} className="w-2 -ml-0.5 h-px bg-zinc-700/80" />
          ))}
          {/* Glowing cursor traveler */}
          <div
            className="absolute left-[-2px] right-[-2px] h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-75"
            style={{ top: `${scrollProgress * 92}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-zinc-400 mt-6 font-semibold">
          {Math.round(scrollProgress * 100)}%
        </span>
      </div>

      {/* =========================================================================
          1. TOP NAVIGATION
          ========================================================================= */}
      <nav className="h-16 border-b border-[#1f1f1f] bg-black/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
              <Server className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              SPACES PANEL
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                PRO
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <button className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer">
                Sign In
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
      </nav>

      {/* =========================================================================
          2. HERO SECTION WITH DIGITALOCEAN WIREFRAME MOUNTAINS & PERSPECTIVE GRID
          ========================================================================= */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background perspective grid plane */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,#000_60%,transparent_100%)] pointer-events-none" />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-white/[0.07] to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          {/* Subtle pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-Cloud Fleet Governance</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1] max-w-3xl mx-auto">
            Control every droplet, instance, and cluster in one place.
          </h1>

          {/* Minimal, direct description */}
          <p className="mt-6 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
            A single, governed control plane for engineers managing infrastructure across DigitalOcean, AWS, GCP, and baremetal.
          </p>

          {/* Call to actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={consoleUrl} className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 py-2.5 rounded-md bg-white text-black hover:bg-[#eaeaea] text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm">
                <span>Launch Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer">
                Login with Seed Account
              </button>
            </Link>
          </div>

          {/* =========================================================================
              DIGITALOCEAN-STYLE WIREFRAME MOUNTAINS & TOPOGRAPHIC GRID
              ========================================================================= */}
          <div className="mt-14 relative w-full max-w-3xl mx-auto pointer-events-none select-none">
            <svg
              className="w-full h-44 sm:h-56 stroke-white/[0.15] fill-none"
              viewBox="0 0 1000 320"
              preserveAspectRatio="none"
            >
              {/* Converging perspective grid lines */}
              <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                <line x1="500" y1="20" x2="0" y2="320" />
                <line x1="500" y1="20" x2="100" y2="320" />
                <line x1="500" y1="20" x2="250" y2="320" />
                <line x1="500" y1="20" x2="400" y2="320" />
                <line x1="500" y1="20" x2="500" y2="320" />
                <line x1="500" y1="20" x2="600" y2="320" />
                <line x1="500" y1="20" x2="750" y2="320" />
                <line x1="500" y1="20" x2="900" y2="320" />
                <line x1="500" y1="20" x2="1000" y2="320" />
              </g>

              {/* Horizontal depth tiers */}
              <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
                <line x1="420" y1="70" x2="580" y2="70" />
                <line x1="340" y1="120" x2="660" y2="120" />
                <line x1="220" y1="180" x2="780" y2="180" />
                <line x1="100" y1="250" x2="900" y2="250" />
                <line x1="0" y1="318" x2="1000" y2="318" />
              </g>

              {/* Topographic Mountain Wireframe Ridges */}
              <path
                d="M 50,300 L 150,220 L 260,260 L 390,140 L 500,60 L 610,150 L 720,220 L 850,180 L 950,300"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M 120,310 L 220,240 L 340,190 L 500,100 L 670,180 L 780,240 L 900,310"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path
                d="M 200,315 L 320,250 L 500,160 L 680,250 L 820,315"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                strokeLinejoin="round"
              />

              {/* Peak Summit Indicator */}
              <circle cx="500" cy="60" r="3" fill="#ffffff" />
              <circle cx="500" cy="60" r="8" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            </svg>
            {/* Linear gradient fade out at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. CLOUD PLATFORMS SECTION: "BEST CLOUD PLATFORMS"
          ========================================================================= */}
      <section className="py-12 border-t border-[#1f1f1f] bg-[#050505]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 font-semibold">
              Supported Infrastructure Providers
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cloudPlatforms.map((p) => (
              <div
                key={p.name}
                className="p-3.5 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                    {p.icon}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">{p.badge}</span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">{p.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. EXACTLY 3 SUBTLE FEATURE CARDS (HUMAN-CRAFTED & MINIMAL)
          ========================================================================= */}
      <section className="py-20 border-t border-[#1f1f1f] bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for real operational control.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400">
              Three essential pillars designed to eliminate blind spots and human error.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CARD 1: FLEET OBSERVABILITY */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 01</span>
                <h3 className="text-lg font-bold text-white mt-1">Zero-Lag Telemetry</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Real host metrics streamed via Prometheus remote-write every 15 seconds. Automatic threshold warnings trigger incident runbooks with zero delay.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  99.98% Monitored SLA
                </span>
                <span>Prometheus</span>
              </div>
            </div>

            {/* CARD 2: TWO-PERSON GOVERNED OPERATIONS */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 02</span>
                <h3 className="text-lg font-bold text-white mt-1">Governed Operations</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Eliminates rogue shell scripts. High-impact tasks like resizing nodes, failovers, and cache purges enforce two-person peer approval before execution.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="text-zinc-300">2-Person Sign-off</span>
                <span className="text-zinc-400 font-semibold">RBAC Verified</span>
              </div>
            </div>

            {/* CARD 3: MULTITENANCY & COST ACCRUAL */}
            <div className="p-6 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-zinc-700 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Pillar 03</span>
                <h3 className="text-lg font-bold text-white mt-1">Scoped Cost Intelligence</h3>
                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                  Organize infrastructure cleanly by Client → Project → Droplet. Track hourly accrual rates and reconcile cloud invoices against real telemetry.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="text-zinc-300">Actuals Reconciliation</span>
                <span className="text-emerald-400 font-semibold">Hourly Accruals</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. LIVE METRICS PREVIEW CANOPY
          ========================================================================= */}
      <section className="py-16 border-t border-[#1f1f1f] bg-[#050505]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden shadow-2xl">
            {/* Header tab */}
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
                  Peak: 84.0%
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
      <section className="py-20 border-t border-[#1f1f1f] bg-black text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Ready to bring order to your infrastructure?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400">
            Sign in to your control-plane workspace or launch with the pre-seeded account.
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
          7. FOOTER
          ========================================================================= */}
      <footer className="border-t border-[#1f1f1f] bg-black py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-zinc-300" />
            <span className="text-zinc-300 font-semibold">SPACES PANEL</span>
            <span>— Multi-Cloud Server Governance</span>
          </div>
          <div>© {new Date().getFullYear()} Enterprise Infrastructure Control Plane</div>
        </div>
      </footer>
    </div>
  );
};
