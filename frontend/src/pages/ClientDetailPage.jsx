import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  FolderGit2,
  Server,
  Plus,
  ArrowLeft,
  Mail,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, ServerStatusBadge, ProviderBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    repositoryUrl: '',
    techStack: 'Node.js, PostgreSQL, Docker',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchClientDetails = async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      if (res.data?.success) {
        setClient(res.data.data);
      }
    } catch (err) {
      showError('Failed to load client details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientDetails();
  }, [id]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/projects', {
        ...projectForm,
        clientId: id,
      });
      if (res.data?.success) {
        success(`Project '${projectForm.name}' created!`);
        setIsAddProjectOpen(false);
        setProjectForm({ name: '', description: '', repositoryUrl: '', techStack: 'Node.js, PostgreSQL, Docker' });
        fetchClientDetails();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !client) {
    return <LoadingSpinner fullPage label="Loading client hierarchy..." />;
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-white">Client not found</h2>
        <Button className="mt-4" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Clients</span>
        </button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddProjectOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Project to Client
        </Button>
      </div>

      {/* Client Overview Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-400">{client.tier} Tenant</span>
              <Badge variant={client.status === 'active' ? 'healthy' : 'neutral'}>{client.status}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">{client.name}</h1>
            <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">{client.description}</p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 text-xs text-slate-400 font-mono">
            <div>SLA: <strong className="text-white">{client.sla}</strong></div>
            {client.contactEmail && <div>Contact: <strong className="text-slate-300">{client.contactEmail}</strong></div>}
            {client.billingReference && <div>Ref: <span className="text-slate-500">{client.billingReference}</span></div>}
          </div>
        </div>
      </Card>

      {/* Projects under this Client */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-purple-400" />
            Scoped Projects ({client.projects?.length || 0})
          </h3>
        </div>

        {client.projects?.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-xs text-slate-400">
            No projects registered under this client yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.projects.map((proj) => (
              <Card
                key={proj._id}
                hoverEffect
                onClick={() => navigate(`/projects/${proj._id}`)}
                className="p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                    <Badge variant="healthy" size="sm">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">{proj.description || 'No description'}</p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {proj.techStack?.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-blue-400">
                  <span>View Project & Environments</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Servers under this Client */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Associated Server Fleet ({client.servers?.length || 0})
        </h3>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {client.servers?.map((server) => (
                  <tr
                    key={server._id}
                    className="hover:bg-slate-900/50 cursor-pointer"
                    onClick={() => navigate(`/servers/${server._id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-white">{server.name}</td>
                    <td className="px-4 py-3">
                      <ServerStatusBadge status={server.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ProviderBadge provider={server.provider} />
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{server.projectId?.name || 'Project'}</td>
                    <td className="px-4 py-3 font-sans text-slate-400">{server.environmentId?.name || 'Env'}</td>
                    <td className="px-4 py-3 text-slate-400">{server.network?.publicIp}</td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      View Node &rarr;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Project Modal */}
      <Modal isOpen={isAddProjectOpen} onClose={() => setIsAddProjectOpen(false)} title={`Add Project to ${client.name}`}>
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Auth Microservice"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Repository URL</label>
            <input
              type="text"
              placeholder="https://github.com/org/repo"
              value={projectForm.repositoryUrl}
              onChange={(e) => setProjectForm({ ...projectForm, repositoryUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tech Stack (comma separated)</label>
            <input
              type="text"
              value={projectForm.techStack}
              onChange={(e) => setProjectForm({ ...projectForm, techStack: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Project Description</label>
            <textarea
              rows={3}
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsAddProjectOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
