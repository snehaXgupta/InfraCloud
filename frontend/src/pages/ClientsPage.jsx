import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Server,
  FolderGit2,
  ShieldCheck,
  Search,
  ExternalLink,
  Mail,
  FileText,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contactEmail: '',
    tier: 'Enterprise',
    sla: '99.95% High Availability',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      if (res.data?.success) {
        setClients(res.data.data);
      }
    } catch (err) {
      showError('Failed to load client list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);

    try {
      const res = await api.post('/clients', formData);
      if (res.data?.success) {
        success(`Client '${formData.name}' created successfully`);
        setIsCreateOpen(false);
        setFormData({ name: '', description: '', contactEmail: '', tier: 'Enterprise', sla: '99.95% High Availability' });
        fetchClients();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.contactEmail?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-400" />
            Client Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Top-level organizational tenant control with scoped projects, environments, and SLA definitions
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add New Client
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients by name, email or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Client List Cards */}
      {isLoading ? (
        <LoadingSpinner fullPage label="Loading managed client accounts..." />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients found"
          description="Create your first client account to begin organizing projects and servers."
          actionLabel="Add Client"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredClients.map((client) => (
            <Card
              key={client._id}
              hoverEffect
              onClick={() => navigate(`/clients/${client._id}`)}
              className="p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400">{client.tier}</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{client.name}</h3>
                  </div>
                  <Badge variant={client.status === 'active' ? 'healthy' : 'neutral'}>
                    {client.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-300 mt-2.5 line-clamp-2 leading-relaxed">
                  {client.description || 'No description provided.'}
                </p>

                {client.contactEmail && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 font-mono">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{client.contactEmail}</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>{client.projectCount || 0} Projects</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Server className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{client.serverCount || 0} Servers</span>
                  </div>
                </div>

                <span className="text-xs text-blue-400 font-semibold flex items-center gap-1">
                  View Scoped Tree <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Client Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Client Account">
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Client Organization Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Global Systems"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Technical Contact Email</label>
            <input
              type="email"
              placeholder="ops@clientdomain.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">SLA Level</label>
              <input
                type="text"
                value={formData.sla}
                onChange={(e) => setFormData({ ...formData, sla: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subscription Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Enterprise">Enterprise</option>
                <option value="Business">Business</option>
                <option value="Startup">Startup</option>
                <option value="Internal">Internal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Description & Purpose</label>
            <textarea
              rows={3}
              placeholder="Brief description of the client's business domain..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Create Client
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
