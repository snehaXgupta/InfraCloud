import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Cloud,
  Key,
  Globe,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
  RefreshCw,
  Cpu,
  HardDrive,
  Network,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const PROVIDER_OPTIONS = [
  {
    id: 'DigitalOcean',
    name: 'DigitalOcean Droplets',
    badge: 'Popular',
    iconColor: 'text-blue-500',
    description: 'Requires Droplet ID & Personal Access Token',
  },
  {
    id: 'AWS',
    name: 'AWS EC2',
    badge: 'Cloud',
    iconColor: 'text-amber-500',
    description: 'Requires Instance ID, Region & Access Key',
  },
  {
    id: 'Hetzner',
    name: 'Hetzner Cloud',
    badge: 'Fast',
    iconColor: 'text-red-500',
    description: 'Requires Server ID & Hetzner API Token',
  },
  {
    id: 'Vultr',
    name: 'Vultr Cloud',
    badge: 'Compute',
    iconColor: 'text-cyan-500',
    description: 'Requires Instance SUBID & Vultr API Key',
  },
  {
    id: 'On-Premise',
    name: 'Custom / On-Premise VPS',
    badge: 'Baremetal',
    iconColor: 'text-emerald-500',
    description: 'Requires Host IP / Domain & SSH Port',
  },
];

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'eu-west-1', name: 'Europe (Ireland)' },
  { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
];

export const AddServerModal = ({ isOpen, onClose, onServerCreated }) => {
  const [provider, setProvider] = useState('DigitalOcean');
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { success, error: showError } = useToast();

  // Provider-specific credentials
  const [dropletId, setDropletId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [serverId, setServerId] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [sshPort, setSshPort] = useState('22');

  // Optional custom attributes
  const [customName, setCustomName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [serverRole, setServerRole] = useState('Application Node');
  const [tags, setTags] = useState('production, web');

  // Hierarchy scoping
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchHierarchy = async () => {
      setIsLoadingMeta(true);
      try {
        const [clientsRes, projectsRes, envsRes] = await Promise.all([
          api.get('/clients').catch(() => ({ data: { data: [] } })),
          api.get('/projects').catch(() => ({ data: { data: [] } })),
          api.get('/environments').catch(() => ({ data: { data: [] } })),
        ]);

        const clientList = clientsRes.data?.data || [];
        const projectList = projectsRes.data?.data || [];
        const envList = envsRes.data?.data || [];

        setClients(clientList);
        setProjects(projectList);
        setEnvironments(envList);

        if (clientList.length > 0 && !clientId) {
          setClientId(clientList[0]._id);
        }
      } catch (err) {
        console.error('Failed to load hierarchy scoping:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchHierarchy();
  }, [isOpen]);

  // Keep project in sync with client
  const filteredProjects = projects.filter(
    (p) => !clientId || p.clientId?._id === clientId || p.clientId === clientId
  );

  useEffect(() => {
    if (filteredProjects.length > 0 && !filteredProjects.some((p) => p._id === projectId)) {
      setProjectId(filteredProjects[0]._id);
    }
  }, [clientId, projects]);

  // Keep environment in sync with project
  const filteredEnvs = environments.filter(
    (e) => !projectId || e.projectId?._id === projectId || e.projectId === projectId
  );

  useEffect(() => {
    if (filteredEnvs.length > 0 && !filteredEnvs.some((e) => e._id === environmentId)) {
      setEnvironmentId(filteredEnvs[0]._id);
    }
  }, [projectId, environments]);

  // Quick-Fill Demo for DigitalOcean
  const handleQuickFillDemo = () => {
    setDropletId('458291044');
    setApiToken('dop_v1_demo_cloud_token_verified');
    setCustomDomain('web-prod.infra.cloud');
    setServerRole('Application Node');
    setTags('production, web, nginx');
    success('Loaded demo DigitalOcean Droplet credentials');
  };

  const handleFetchAndAdd = async (e) => {
    e.preventDefault();

    // Provider-specific validation
    if (provider === 'DigitalOcean') {
      if (!dropletId.trim()) {
        showError('Please enter the DigitalOcean Droplet ID');
        return;
      }
      if (!apiToken.trim()) {
        showError('Please enter your DigitalOcean Personal Access Token');
        return;
      }
    } else if (provider === 'AWS') {
      if (!instanceId.trim()) {
        showError('Please enter your AWS EC2 Instance ID (e.g. i-0123456789abcdef0)');
        return;
      }
    } else if (provider === 'Hetzner') {
      if (!serverId.trim() || !apiToken.trim()) {
        showError('Please enter the Hetzner Server ID and API Token');
        return;
      }
    } else if (provider === 'Vultr') {
      if (!instanceId.trim() || !apiToken.trim()) {
        showError('Please enter the Vultr SUBID and API Key');
        return;
      }
    } else if (provider === 'On-Premise') {
      if (!hostIp.trim()) {
        showError('Please enter the Server Host IP / FQDN');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        provider,
        dropletId: dropletId.trim(),
        apiToken: apiToken.trim(),
        instanceId: instanceId.trim(),
        serverId: serverId.trim(),
        region: provider === 'AWS' ? awsRegion : undefined,
        hostIp: hostIp.trim(),
        sshPort: Number(sshPort) || 22,
        customName: customName.trim(),
        customDomain: customDomain.trim(),
        serverRole,
        tags,
        clientId: clientId || undefined,
        projectId: projectId || undefined,
        environmentId: environmentId || undefined,
      };

      const res = await api.post('/servers/fetch-and-add', payload);

      if (res.data?.success) {
        const newServer = res.data.data;
        success(
          `Droplet '${newServer.name}' added with IP ${newServer.network?.publicIp} and ${newServer.websites?.length || 2} hosted virtual hosts!`
        );
        if (onServerCreated) {
          onServerCreated(newServer);
        }
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to fetch and register server';
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Droplet / Cloud Server"
      subtitle="Select your provider, supply authentication credentials, and auto-discover system specifications & virtual hosts."
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleFetchAndAdd} className="space-y-4">
        {/* 1. Primary Provider Selection Dropdown */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070707] border border-slate-200 dark:border-[#1f1f1f] space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase font-mono tracking-wider">
            <span className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-blue-500" />
              1. Select Server Provider *
            </span>
            <span className="text-[10px] text-slate-500 dark:text-[#888888] font-normal normal-case">
              Select target cloud platform
            </span>
          </label>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#2a2a2a] rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors shadow-xs"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.badge}) — {opt.description}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Provider-Specific Dynamic Input Fields */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0b0b0b] border border-slate-200 dark:border-[#1f1f1f] space-y-3.5 shadow-xs">
          {provider === 'DigitalOcean' && (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    DigitalOcean Droplet Credentials
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleQuickFillDemo}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Demo Quick-Fill
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Droplet ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 458291044 or droplet name"
                    value={dropletId}
                    onChange={(e) => setDropletId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-[#777777] mt-0.5 block">
                    Found in your DigitalOcean Droplet overview URL or CLI
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Personal Access Token *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[10px] text-slate-500 dark:text-[#888888] hover:text-black dark:hover:text-white flex items-center gap-0.5"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showToken ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    placeholder="dop_v1_xxxxxxxxxxxxxxxx"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-[#777777] mt-0.5 block">
                    Needs Droplet Read scope (or full access)
                  </span>
                </div>
              </div>
            </>
          )}

          {provider === 'AWS' && (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#1a1a1a]">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  AWS EC2 Instance Identification
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    EC2 Instance ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="i-0123456789abcdef0"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    AWS Region *
                  </label>
                  <select
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} ({r.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    AWS Access Key / Bearer Token
                  </label>
                  <input
                    type="password"
                    placeholder="AKIAIOSFODNN7EXAMPLE (or leave blank if using IAM instance profile)"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'Hetzner' && (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#1a1a1a]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Hetzner Cloud Server Details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Server ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3918204"
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Hetzner API Token *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Hetzner Cloud API Token"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'Vultr' && (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#1a1a1a]">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Vultr Instance Parameters
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instance SUBID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. subid-49201"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vultr API Key *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Vultr API Key"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'On-Premise' && (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-[#1a1a1a]">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Baremetal / Custom VPS Connection
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Public Host IP or FQDN *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="139.59.74.30 or node1.example.com"
                    value={hostIp}
                    onChange={(e) => setHostIp(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Intelligent Automation Callout */}
          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-[#07131e] border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>Auto-Discovery Enabled:</strong> Public and private VPC IPs, vCPU/RAM specs, active web engine (Nginx/Apache), SSL certificates, and hosted virtual hosts will be extracted and saved automatically.
            </span>
          </div>
        </div>

        {/* 3. Optional Settings & Scoping Accordion */}
        <div className="rounded-xl border border-slate-200 dark:border-[#1f1f1f] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#080808] hover:bg-slate-100 dark:hover:bg-[#111111] text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Optional Settings & Scoping (Client, Project, Domain, Role)
            </span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="p-4 bg-white dark:bg-[#0c0c0c] space-y-3.5 border-t border-slate-200 dark:border-[#1f1f1f] text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">
                    Custom Name Override (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to provider name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">
                    Primary Domain / Website Hint (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. api.domain.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] font-mono focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>

              {/* Hierarchy Scoping Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  >
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">Project</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  >
                    {filteredProjects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">Environment</label>
                  <select
                    value={environmentId}
                    onChange={(e) => setEnvironmentId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  >
                    {filteredEnvs.map((env) => (
                      <option key={env._id} value={env._id}>
                        {env.name} ({env.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">Server Role</label>
                  <select
                    value={serverRole}
                    onChange={(e) => setServerRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  >
                    <option value="Application Node">Application Node</option>
                    <option value="API Gateway">API Gateway</option>
                    <option value="Primary Database">Primary Database</option>
                    <option value="Replica Database">Replica Database</option>
                    <option value="Worker Queue">Worker Queue</option>
                    <option value="Cache Cluster">Cache Cluster</option>
                    <option value="Storage Node">Storage Node</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-[#888888] mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="production, web, api"
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#1f1f1f]">
          <span className="text-[11px] text-slate-500 dark:text-[#888888] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Tokens sealed via AES-256-GCM
          </span>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching & Discovering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add & Fetch {provider === 'DigitalOcean' ? 'Droplet' : 'Server'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
