import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Server,
  Shield,
  Activity,
  TerminalSquare,
  Building2,
  FolderGit2,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  HardDrive,
  Network,
  Zap,
  ChevronRight,
  Eye,
  Database,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { MetricLineChart, NetworkTrafficChart } from '../components/charts/MetricLineChart';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('hierarchy');

  // Sample monitoring telemetry points for landing preview
  const sampleTelemetry = [
    { label: '00:00', cpu: 28, memory: 44, networkIn: 42, networkOut: 65 },
    { label: '04:00', cpu: 32, memory: 48, networkIn: 58, networkOut: 80 },
    { label: '08:00', cpu: 74, memory: 68, networkIn: 140, networkOut: 195 },
    { label: '12:00', cpu: 62, memory: 65, networkIn: 120, networkOut: 160 },
    { label: '16:00', cpu: 85, memory: 78, networkIn: 185, networkOut: 230 },
    { label: '20:00', cpu: 48, memory: 56, networkIn: 90, networkOut: 115 },
    { label: '24:00', cpu: 35, memory: 50, networkIn: 50, networkOut: 75 },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. TOP NAVBAR */}
      <nav className="h-20 border-b border-slate-800/80 bg-[#080c14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-mono font-bold shadow-lg shadow-blue-600/20">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                InfraControl
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Phase 1
                </span>
              </span>
              <span className="text-xs text-slate-400 font-mono">Server Management Platform</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-blue-400 transition-colors">
              Features
            </a>
            <a href="#hierarchy" className="hover:text-blue-400 transition-colors">
              Hierarchy
            </a>
            <a href="#monitoring" className="hover:text-blue-400 transition-colors">
              Monitoring
            </a>
            <a href="#security" className="hover:text-blue-400 transition-colors">
              Security
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Console
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="relative pt-20 pb-28 overflow-hidden">
        {/* Ambient Grid & Glow Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-[140px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Unified Multi-Cloud Control Plane
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Manage your infrastructure from <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">one control plane</span>.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Monitor servers, track health metrics, manage alerts, and perform controlled infrastructure operations across clients and environments from a single platform.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full px-8 py-3 text-base shadow-xl shadow-blue-600/25" rightIcon={<ArrowRight className="w-5 h-5" />}>
                View Dashboard
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full px-8 py-3 text-base">
                Login with Seed Account
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]/90 backdrop-blur-md">
              <p className="text-xs text-slate-400 font-mono">GLOBAL HEALTH</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">99.98% SLA</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]/90 backdrop-blur-md">
              <p className="text-xs text-slate-400 font-mono">ACTIVE INSTANCES</p>
              <p className="text-xl font-bold text-white mt-1">10 Dedicated Nodes</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]/90 backdrop-blur-md">
              <p className="text-xs text-slate-400 font-mono">OPERATION SECURITY</p>
              <p className="text-xl font-bold text-blue-400 mt-1">100% RBAC Audited</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0d131f]/90 backdrop-blur-md">
              <p className="text-xs text-slate-400 font-mono">TELEMETRY LATENCY</p>
              <p className="text-xl font-bold text-cyan-400 mt-1">&lt; 1000ms Heartbeat</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT PREVIEW SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="rounded-2xl border border-slate-700/80 bg-[#0d131f] shadow-2xl overflow-hidden">
          {/* Simulated Browser Frame */}
          <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            </div>
            <div className="px-4 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 w-80 text-center truncate">
              https://infracontrol.internal/dashboard
            </div>
            <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE TELEMETRY
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Cluster Telemetry Stream
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time aggregate CPU & Memory load across production instances</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="healthy">10/10 Nodes Responding</Badge>
                <Link to="/servers">
                  <Button size="xs" variant="outline" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    View Server Inventory
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-300">Cluster CPU Load Trend</span>
                  <span className="text-xs font-mono text-blue-400">Peak: 85.0%</span>
                </div>
                <MetricLineChart data={sampleTelemetry} metricKey="cpu" metricName="CPU Utilization" color="#3b82f6" height={190} />
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-300">Network Ingress / Egress Throughput</span>
                  <span className="text-xs font-mono text-cyan-400">Max: 230 Mbps</span>
                </div>
                <NetworkTrafficChart data={sampleTelemetry} height={190} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HIERARCHY SECTION */}
      <section id="hierarchy" className="py-20 border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">Multi-Tenant Architecture</span>
            <h2 className="text-3xl font-bold text-white mt-2">Explicit Infrastructure Hierarchy</h2>
            <p className="text-slate-400 text-sm mt-3">
              Maintain clean isolation and granular access scoping from top-level enterprise clients down to individual server daemons.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col items-center text-center group hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400">Level 1</span>
              <h4 className="text-base font-bold text-white mt-1">Client</h4>
              <p className="text-xs text-slate-400 mt-2">
                Top-level tenant or organization entity. Enforces SLA contracts and billing reference.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col items-center text-center group hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">Level 2</span>
              <h4 className="text-base font-bold text-white mt-1">Project</h4>
              <p className="text-xs text-slate-400 mt-2">
                Specific application or service ecosystem linked to code repository and tech stack.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col items-center text-center group hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Level 3</span>
              <h4 className="text-base font-bold text-white mt-1">Environment</h4>
              <p className="text-xs text-slate-400 mt-2">
                Development, Staging, and Production deployment topologies with cluster configs.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] flex flex-col items-center text-center group hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Server className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Level 4</span>
              <h4 className="text-base font-bold text-white mt-1">Server Node</h4>
              <p className="text-xs text-slate-400 mt-2">
                Compute instance with hardware specs, network IPs, telemetry agent, and tags.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FEATURE SECTION */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">Platform Capabilities</span>
          <h2 className="text-3xl font-bold text-white mt-2">Engineered for Infrastructure Reliability</h2>
          <p className="text-slate-400 text-sm mt-3">
            Essential Phase 1 control-plane features designed to eliminate operational blind spots.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <Activity className="w-7 h-7 text-blue-400 mb-4" />
            <h3 className="text-base font-bold text-white">Server Health Monitoring</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Track CPU, memory, disk I/O, network bandwidth, and heartbeat latency with time-series historical charts.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <AlertTriangle className="w-7 h-7 text-amber-400 mb-4" />
            <h3 className="text-base font-bold text-white">Smart Threshold Alerts</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Automatic warning and critical triggers on hardware thresholds (&gt;85%, &gt;95%) with audit acknowledgment tracking.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <TerminalSquare className="w-7 h-7 text-emerald-400 mb-4" />
            <h3 className="text-base font-bold text-white">Controlled Operations</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Pre-approved operation catalog (Health Check, Sync, Restart, Cleanup) eliminating arbitrary un-audited shell risks.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <Database className="w-7 h-7 text-purple-400 mb-4" />
            <h3 className="text-base font-bold text-white">Multi-Cloud Inventory</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Manage AWS, GCP, Azure, DigitalOcean, Hetzner, and On-Premise baremetal servers with tag filtering and search.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <Lock className="w-7 h-7 text-cyan-400 mb-4" />
            <h3 className="text-base font-bold text-white">Role-Based Access (RBAC)</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Granular roles: Platform Admin, DevOps Lead, Project Admin, Client Admin, Client Viewer, and Auditor.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-[#0d131f] hover:border-slate-700 transition-all">
            <Shield className="w-7 h-7 text-rose-400 mb-4" />
            <h3 className="text-base font-bold text-white">Security & Audit Logs</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Immutable logs for every login, state modification, operation dispatch, and alert acknowledgment with IP metadata.
            </p>
          </div>
        </div>
      </section>

      {/* 6. SECURITY SECTION */}
      <section id="security" className="py-20 border-t border-slate-800 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-4">
                <Shield className="w-3.5 h-3.5" />
                Enterprise Security Model
              </div>

              <h2 className="text-3xl font-bold text-white leading-tight">
                Operations are strictly controlled, audited, and deterministic.
              </h2>

              <p className="text-slate-400 text-sm mt-4 leading-relaxed">
                Traditional remote shell access opens infrastructure to human error and blind spots. InfraControl
                enforces strict RBAC and approved catalog orchestration.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm">No Unrestricted Shells:</strong>
                    <p className="text-xs text-slate-400">All actions are mapped to verified catalog endpoints.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm">Scoped Permissions:</strong>
                    <p className="text-xs text-slate-400">Restricts operations according to authenticated user role.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-sm">Immutable Audit Trail:</strong>
                    <p className="text-xs text-slate-400">Every single control-plane action is persisted with client IP and user metadata.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Code Showcase */}
            <div className="code-box rounded-xl p-5 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs text-slate-400 font-mono">
                <span>security_policy.json</span>
                <span className="text-emerald-400">VERIFIED</span>
              </div>
              <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
{`{
  "rbac_enforced": true,
  "arbitrary_shell_execution": "BLOCKED",
  "approved_catalog": [
    "HEALTH_CHECK",
    "SERVICE_RESTART",
    "SYNC_MANIFEST",
    "REPLICA_RECOVERY",
    "CLEANUP",
    "AGENT_UPDATE"
  ],
  "audit_logging": "MANDATORY_ALL_ACTIONS",
  "tls_handshake": "mTLS_v1.3"
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA SECTION */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to inspect your servers?</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            Log in directly with the pre-seeded development credentials to explore the interactive Phase 1 control plane.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="px-8 py-3" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Get Started
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="secondary" className="px-8 py-3">
                Open Dashboard Directly
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-500" />
            <span className="text-slate-300 font-semibold">Server Management Platform</span>
            <span>— Phase 1 MVP</span>
          </div>

          <div>Built with React, Vite, Node.js, Express, and MongoDB</div>

          <div>© {new Date().getFullYear()} Enterprise Infrastructure Plane</div>
        </div>
      </footer>
    </div>
  );
};
