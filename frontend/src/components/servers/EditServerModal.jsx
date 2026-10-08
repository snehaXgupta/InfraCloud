import React, { useState, useEffect } from 'react';
import { Edit2, Cpu, HardDrive, Network, Layers } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const EditServerModal = ({ isOpen, server, onClose, onServerUpdated }) => {
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    provider: 'DigitalOcean',
    region: 'Bangalore 1',
    instanceType: 's-4vcpu-8gb',
    serverRole: 'Application Node',
    status: 'healthy',
    vcpu: 4,
    ramGb: 8,
    diskTotalGb: 80,
    publicIp: '',
    tags: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name || '',
        hostname: server.hostname || '',
        provider: server.provider || 'DigitalOcean',
        region: server.region || 'Bangalore 1',
        instanceType: server.instanceType || 's-4vcpu-8gb',
        serverRole: server.serverRole || 'Application Node',
        status: server.status || 'healthy',
        vcpu: server.compute?.vcpu || 4,
        ramGb: server.compute?.ramGb || 8,
        diskTotalGb: server.storage?.diskTotalGb || 80,
        publicIp: server.network?.publicIp || '',
        tags: Array.isArray(server.tags) ? server.tags.join(', ') : '',
      });
    }
  }, [server, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!server?._id) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        hostname: formData.hostname,
        provider: formData.provider,
        region: formData.region,
        instanceType: formData.instanceType,
        serverRole: formData.serverRole,
        status: formData.status,
        compute: {
          vcpu: Number(formData.vcpu),
          ramGb: Number(formData.ramGb),
          arch: 'x86_64',
        },
        storage: {
          diskTotalGb: Number(formData.diskTotalGb),
          diskUsedGb: Math.round(Number(formData.diskTotalGb) * 0.35),
        },
        network: {
          publicIp: formData.publicIp || server.network?.publicIp,
        },
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      const res = await api.put(`/servers/${server._id}`, payload);
      if (res.data?.success) {
        success(`Droplet '${formData.name}' updated successfully!`);
        if (onServerUpdated) onServerUpdated(res.data.data);
        onClose();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update droplet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Droplet: ${server?.name || ''}`}
      subtitle="Modify droplet hardware configuration, region, and routing"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Droplet Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Public IP</label>
            <input
              type="text"
              value={formData.publicIp}
              onChange={(e) => setFormData({ ...formData, publicIp: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Region / Datacenter</label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="DigitalOcean">DigitalOcean</option>
              <option value="Vultr">Vultr</option>
              <option value="AWS">AWS</option>
              <option value="GCP">GCP</option>
              <option value="Azure">Azure</option>
              <option value="Hetzner">Hetzner</option>
              <option value="On-Premise">On-Premise</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="healthy">Active / Healthy</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance (alerts paused)</option>
            </select>
          </div>
        </div>

        {/* Compute Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">vCPUs</label>
            <input
              type="number"
              min="1"
              max="128"
              value={formData.vcpu}
              onChange={(e) => setFormData({ ...formData, vcpu: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
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
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">SSD Disk (GB)</label>
            <input
              type="number"
              min="10"
              max="10000"
              value={formData.diskTotalGb}
              onChange={(e) => setFormData({ ...formData, diskTotalGb: e.target.value })}
              className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="production, web, api"
            className="w-full bg-[#0d0f15] border border-[#262c3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#1c202c]">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
