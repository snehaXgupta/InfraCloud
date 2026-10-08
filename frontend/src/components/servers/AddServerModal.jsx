import React, { useState, useEffect } from 'react';
import { Server, Plus, HardDrive, Cpu, Network, Layers } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const AddServerModal = ({ isOpen, onClose, onServerCreated }) => {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const [formData, setFormData] = useState({
    clientId: '',
    projectId: '',
    environmentId: '',
    name: '',
    hostname: '',
    provider: 'AWS',
    region: 'us-east-1',
    instanceType: 'c6i.xlarge',
    serverRole: 'Application Node',
    status: 'healthy',
    os: 'Ubuntu 22.04 LTS (x86_64)',
    vcpu: 4,
    ramGb: 16,
    diskTotalGb: 250,
    tags: 'production, web',
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchHierarchy = async () => {
      setIsLoadingMeta(true);
      try {
        const [clientsRes, projectsRes, envsRes] = await Promise.all([
          api.get('/clients'),
          api.get('/projects'),
          api.get('/environments'),
        ]);

        if (clientsRes.data?.success) setClients(clientsRes.data.data);
        if (projectsRes.data?.success) setProjects(projectsRes.data.data);
        if (envsRes.data?.success) setEnvironments(envsRes.data.data);

        // Pre-select first items if available
        if (clientsRes.data?.data?.[0]) {
          setFormData((prev) => ({
            ...prev,
            clientId: prev.clientId || clientsRes.data.data[0]._id,
          }));
        }
      } catch (err) {
        showError('Failed to fetch hierarchy data');
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchHierarchy();
  }, [isOpen]);

  // Filter projects by selected client
  const filteredProjects = projects.filter(
    (p) => !formData.clientId || p.clientId?._id === formData.clientId || p.clientId === formData.clientId
  );

  // Auto-set project if none selected
  useEffect(() => {
    if (filteredProjects.length > 0 && !filteredProjects.some((p) => p._id === formData.projectId)) {
      setFormData((prev) => ({ ...prev, projectId: filteredProjects[0]._id }));
    }
  }, [formData.clientId, projects]);

  // Filter environments by selected project
  const filteredEnvs = environments.filter(
    (e) => !formData.projectId || e.projectId?._id === formData.projectId || e.projectId === formData.projectId
  );

  useEffect(() => {
    if (filteredEnvs.length > 0 && !filteredEnvs.some((e) => e._id === formData.environmentId)) {
      setFormData((prev) => ({ ...prev, environmentId: filteredEnvs[0]._id }));
    }
  }, [formData.projectId, environments]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.clientId || !formData.projectId || !formData.environmentId) {
      showError('Please fill out all required hierarchy and server fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        clientId: formData.clientId,
        projectId: formData.projectId,
        environmentId: formData.environmentId,
        name: formData.name,
        hostname: formData.hostname || `${formData.name.toLowerCase().replace(/\s+/g, '-')}.infra.local`,
        provider: formData.provider,
        region: formData.region,
        instanceType: formData.instanceType,
        serverRole: formData.serverRole,
        status: formData.status,
        os: formData.os,
        compute: {
          vcpu: Number(formData.vcpu),
          ramGb: Number(formData.ramGb),
          arch: 'x86_64',
        },
        storage: {
          diskTotalGb: Number(formData.diskTotalGb),
          diskUsedGb: Math.round(Number(formData.diskTotalGb) * 0.25),
        },
        tags: formData.tags.split(',').map((t) => t.trim()),
      };

      const res = await api.post('/servers', payload);
      if (res.data?.success) {
        success(`Server '${formData.name}' registered to control plane!`);
        if (onServerCreated) onServerCreated(res.data.data);
        onClose();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Provision & Register Server Node"
      subtitle="Register an infrastructure node into the control plane hierarchy"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hierarchy Section */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase font-mono">
            <Layers className="w-4 h-4" />
            Infrastructure Hierarchy Scoping
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client *</label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs text-slate-400 mb-1">Project *</label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs text-slate-400 mb-1">Environment *</label>
              <select
                value={formData.environmentId}
                onChange={(e) => setFormData({ ...formData, environmentId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                required
              >
                {filteredEnvs.map((env) => (
                  <option key={env._id} value={env._id}>
                    {env.name} ({env.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Server Identification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Server Name *</label>
            <input
              type="text"
              placeholder="e.g. Production API Node 03"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Hostname (FQDN)</label>
            <input
              type="text"
              placeholder="api-node-03.us-east.internal"
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Cloud Provider & Role */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cloud Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="AWS">AWS (Amazon Web Services)</option>
              <option value="GCP">GCP (Google Cloud)</option>
              <option value="Azure">Microsoft Azure</option>
              <option value="DigitalOcean">DigitalOcean</option>
              <option value="Vultr">Vultr</option>
              <option value="Hetzner">Hetzner Cloud</option>
              <option value="On-Premise">On-Premise Baremetal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Region / Zone</label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Server Role</label>
            <select
              value={formData.serverRole}
              onChange={(e) => setFormData({ ...formData, serverRole: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
        </div>

        {/* Compute & Hardware Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Instance Type</label>
            <input
              type="text"
              value={formData.instanceType}
              onChange={(e) => setFormData({ ...formData, instanceType: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">vCPU Cores</label>
            <input
              type="number"
              min="1"
              max="128"
              value={formData.vcpu}
              onChange={(e) => setFormData({ ...formData, vcpu: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">RAM (GB)</label>
            <input
              type="number"
              min="1"
              max="1024"
              value={formData.ramGb}
              onChange={(e) => setFormData({ ...formData, ramGb: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Disk (GB)</label>
            <input
              type="number"
              min="10"
              max="10000"
              value={formData.diskTotalGb}
              onChange={(e) => setFormData({ ...formData, diskTotalGb: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Operating System & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Operating System</label>
            <input
              type="text"
              value={formData.os}
              onChange={(e) => setFormData({ ...formData, os: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="production, web, docker"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
            Provision Server
          </Button>
        </div>
      </form>
    </Modal>
  );
};
