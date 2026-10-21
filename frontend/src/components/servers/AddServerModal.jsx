import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const PROVIDER_OPTIONS = [
  { id: 'DigitalOcean', name: 'DigitalOcean Droplets' },
  { id: 'AWS', name: 'AWS EC2' },
  { id: 'Hetzner', name: 'Hetzner Cloud' },
  { id: 'Vultr', name: 'Vultr' },
  { id: 'On-Premise', name: 'Custom / On-Premise VPS' },
];

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'us-east-1 (N. Virginia)' },
  { id: 'us-east-2', name: 'us-east-2 (Ohio)' },
  { id: 'us-west-2', name: 'us-west-2 (Oregon)' },
  { id: 'eu-west-1', name: 'eu-west-1 (Ireland)' },
  { id: 'eu-central-1', name: 'eu-central-1 (Frankfurt)' },
  { id: 'ap-south-1', name: 'ap-south-1 (Mumbai)' },
  { id: 'ap-southeast-1', name: 'ap-southeast-1 (Singapore)' },
];

export const AddServerModal = ({ isOpen, onClose, onServerCreated }) => {
  const [provider, setProvider] = useState('DigitalOcean');
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { success, error: showError } = useToast();

  // Hierarchy scoping
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');

  // Provider credentials
  const [dropletId, setDropletId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [serverId, setServerId] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [sshPort, setSshPort] = useState('22');

  // Optional attributes
  const [customName, setCustomName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [serverRole, setServerRole] = useState('Application Node');
  const [tags, setTags] = useState('production, web');

  useEffect(() => {
    if (!isOpen) return;

    const fetchHierarchy = async () => {
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
        console.error('Failed to load scoping:', err);
      }
    };

    fetchHierarchy();
  }, [isOpen]);

  // Sync projects with selected client
  const filteredProjects = projects.filter(
    (p) => !clientId || p.clientId?._id === clientId || p.clientId === clientId
  );

  useEffect(() => {
    if (filteredProjects.length > 0 && !filteredProjects.some((p) => p._id === projectId)) {
      setProjectId(filteredProjects[0]._id);
    }
  }, [clientId, projects]);

  // Sync environments with selected project
  const filteredEnvs = environments.filter(
    (e) => !projectId || e.projectId?._id === projectId || e.projectId === projectId
  );

  useEffect(() => {
    if (filteredEnvs.length > 0 && !filteredEnvs.some((e) => e._id === environmentId)) {
      setEnvironmentId(filteredEnvs[0]._id);
    }
  }, [projectId, environments]);

  // Quick-Fill Demo
  const handleQuickFillDemo = () => {
    setDropletId('458291044');
    setApiToken('dop_v1_demo_cloud_token_verified');
    setCustomDomain('web-prod.infra.cloud');
    setServerRole('Application Node');
    setTags('production, web');
    success('Loaded demo credentials');
  };

  const handleFetchAndAdd = async (e) => {
    e.preventDefault();

    if (!clientId) return showError('Please select a Client');
    if (!projectId) return showError('Please select a Project');

    if (provider === 'DigitalOcean') {
      if (!dropletId.trim()) return showError('Droplet ID is required');
      if (!apiToken.trim()) return showError('DigitalOcean API Token is required');
    } else if (provider === 'AWS') {
      if (!instanceId.trim()) return showError('AWS Instance ID is required');
    } else if (provider === 'Hetzner') {
      if (!serverId.trim() || !apiToken.trim()) return showError('Server ID and API Token are required');
    } else if (provider === 'Vultr') {
      if (!instanceId.trim() || !apiToken.trim()) return showError('SUBID and API Key are required');
    } else if (provider === 'On-Premise') {
      if (!hostIp.trim()) return showError('Host IP is required');
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
        clientId,
        projectId,
        environmentId: environmentId || undefined,
      };

      const res = await api.post('/servers/fetch-and-add', payload);

      if (res.data?.success) {
        const newServer = res.data.data;
        success(`Server '${newServer.name}' added successfully (${newServer.network?.publicIp})`);
        if (onServerCreated) onServerCreated(newServer);
        onClose();
      }
    } catch (err) {
      showError(err.response?.data?.error || err.message || 'Failed to add server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Server"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleFetchAndAdd} className="space-y-3.5 text-xs">
        {/* Provider Select */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Provider *
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Hierarchy Scoping */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Client *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              required
            >
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Project *
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              required
            >
              {filteredProjects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
              Environment *
            </label>
            <select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
              required
            >
              {filteredEnvs.length > 0 ? (
                filteredEnvs.map((env) => (
                  <option key={env._id} value={env._id}>
                    {env.name}
                  </option>
                ))
              ) : (
                <option value="">Default (Production)</option>
              )}
            </select>
          </div>
        </div>

        {/* Provider Credentials */}
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1e1e1e] space-y-3">
          {provider === 'DigitalOcean' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  DigitalOcean Credentials
                </span>
                <button
                  type="button"
                  onClick={handleQuickFillDemo}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Quick Fill Demo
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Droplet ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 458291044"
                    value={dropletId}
                    onChange={(e) => setDropletId(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">
                      Personal Access Token *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="text-[10px] text-slate-400 hover:text-black dark:hover:text-white"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    placeholder="dop_v1_..."
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'AWS' && (
            <>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                AWS EC2 Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Instance ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="i-0123456789abcdef0"
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Region *
                  </label>
                  <select
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors font-mono"
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Access Key / Bearer Token
                  </label>
                  <input
                    type="password"
                    placeholder="AKIA..."
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'Hetzner' && (
            <>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Hetzner Cloud Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Server ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3918204"
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    API Token *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Hetzner token"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'Vultr' && (
            <>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Vultr Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Instance SUBID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="subid-..."
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    API Key *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Vultr API Key"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {provider === 'On-Premise' && (
            <>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                VPS / Host Connection
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Host IP / FQDN *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="139.59.74.30"
                    value={hostIp}
                    onChange={(e) => setHostIp(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-[#222222] rounded-lg px-2.5 py-1.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Optional Parameters */}
        <div className="rounded-lg border border-slate-200 dark:border-[#1e1e1e] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0a0a] hover:bg-slate-100 dark:hover:bg-[#111111] text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Optional Settings (Name, Domain, Role, Tags)</span>
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAdvanced && (
            <div className="p-3 bg-white dark:bg-black space-y-2.5 border-t border-slate-200 dark:border-[#1e1e1e]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Custom Name Override
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to provider name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Primary Domain / VHost
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. app.domain.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Role</label>
                  <select
                    value={serverRole}
                    onChange={(e) => setServerRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white"
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
                  <label className="block text-[10px] text-slate-500 mb-1">Tags</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="production, web"
                    className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#1a1a1a]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white font-medium cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>Add & Fetch {provider === 'DigitalOcean' ? 'Droplet' : 'Server'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
