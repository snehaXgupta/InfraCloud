import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Plus,
  Building2,
  Server,
  Layers,
  Search,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    description: '',
    repositoryUrl: '',
    techStack: 'Go, Kafka, PostgreSQL',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchProjects = async () => {
    try {
      const [projRes, clientRes] = await Promise.all([
        api.get('/projects'),
        api.get('/clients'),
      ]);
      if (projRes.data?.success) setProjects(projRes.data.data);
      if (clientRes.data?.success) {
        setClients(clientRes.data.data);
        if (clientRes.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, clientId: clientRes.data.data[0]._id }));
        }
      }
    } catch (err) {
      showError('Failed to load project inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.clientId) return;
    setIsSubmitting(true);

    try {
      const res = await api.post('/projects', formData);
      if (res.data?.success) {
        success(`Project '${formData.name}' created with default environments!`);
        setIsCreateOpen(false);
        fetchProjects();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.clientId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-purple-400" />
            Project Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Application microservices, infrastructure stacks, and scoped deployment environments
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Create Project
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search projects or client names..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Project Cards Grid */}
      {isLoading ? (
        <LoadingSpinner fullPage label="Loading projects..." />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects found"
          description="Create your first infrastructure project to begin managing environment clusters."
          actionLabel="Create Project"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {filteredProjects.map((proj) => (
            <Card
              key={proj._id}
              hoverEffect
              onClick={() => navigate(`/projects/${proj._id}`)}
              className="p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
                      {proj.clientId?.name || 'Client Org'}
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">{proj.name}</h3>
                  </div>
                  <Badge variant="healthy" size="sm">
                    Active
                  </Badge>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {proj.description || 'No description provided.'}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {proj.techStack?.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    {proj.environmentCount || 3} Envs
                  </span>
                  <span className="flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-cyan-400" />
                    {proj.serverCount || 0} Nodes
                  </span>
                </div>

                <span className="text-blue-400 font-semibold flex items-center gap-1">
                  Manage &rarr;
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Project">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Parent Client Organization *</label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              required
            >
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.tier})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Identity & Access Gateway"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Repository URL</label>
            <input
              type="text"
              placeholder="https://github.com/organization/repo"
              value={formData.repositoryUrl}
              onChange={(e) => setFormData({ ...formData, repositoryUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tech Stack (comma separated)</label>
            <input
              type="text"
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              rows={3}
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
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
