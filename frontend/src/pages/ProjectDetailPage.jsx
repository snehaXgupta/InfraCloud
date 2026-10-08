import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderGit2,
  Building2,
  Server,
  Layers,
  ArrowLeft,
  Plus,
  GitBranch,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, ServerStatusBadge, ProviderBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddEnvOpen, setIsAddEnvOpen] = useState(false);
  const [envForm, setEnvForm] = useState({
    name: '',
    type: 'Development',
    clusterUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: showError } = useToast();

  const fetchProjectDetails = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      if (res.data?.success) {
        setProject(res.data.data);
      }
    } catch (err) {
      showError('Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const handleCreateEnv = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/environments', {
        ...envForm,
        projectId: id,
      });
      if (res.data?.success) {
        success(`Environment '${envForm.name}' created!`);
        setIsAddEnvOpen(false);
        setEnvForm({ name: '', type: 'Development', clusterUrl: '' });
        fetchProjectDetails();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create environment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !project) {
    return <LoadingSpinner fullPage label="Loading project architecture..." />;
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-white">Project not found</h2>
        <Button className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Projects</span>
        </button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddEnvOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Environment
        </Button>
      </div>

      {/* Project Overview Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to={`/clients/${project.clientId?._id}`}
                className="text-xs font-mono text-purple-400 hover:underline flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" />
                {project.clientId?.name || 'Client Org'}
              </Link>
              <span className="text-slate-600">/</span>
              <Badge variant="healthy" size="sm">Active</Badge>
            </div>

            <h1 className="text-2xl font-bold text-white mt-1">{project.name}</h1>
            <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">{project.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {project.techStack?.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-xs text-slate-400 font-mono">
            {project.repositoryUrl && (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-blue-400 hover:underline"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Repository Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div>Lead DevOps: <strong className="text-slate-200">{project.leadDevOps || 'Core Infra'}</strong></div>
          </div>
        </div>
      </Card>

      {/* Environments Section */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          Deployment Environments ({project.environments?.length || 0})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {project.environments?.map((env) => (
            <Card key={env._id} className="p-5">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                    env.type === 'Production'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : env.type === 'Staging'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {env.type}
                </span>
                <Badge variant={env.status === 'healthy' ? 'healthy' : 'warning'} size="sm">
                  {env.status}
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-white mt-2">{env.name}</h4>

              {env.clusterUrl && (
                <p className="text-[11px] font-mono text-slate-500 truncate mt-1">{env.clusterUrl}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Cluster Node Health</span>
                <span className="text-emerald-400 font-semibold">100% OK</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Servers in this Project */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Server Instances ({project.servers?.length || 0})
        </h3>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Public IP</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {project.servers?.map((server) => (
                  <tr
                    key={server._id}
                    className="hover:bg-slate-900/50 cursor-pointer"
                    onClick={() => navigate(`/servers/${server._id}`)}
                  >
                    <td className="px-4 py-3 font-semibold text-white">{server.name}</td>
                    <td className="px-4 py-3 font-sans text-slate-300">{server.environmentId?.name || 'Env'}</td>
                    <td className="px-4 py-3">
                      <ServerStatusBadge status={server.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ProviderBadge provider={server.provider} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{server.network?.publicIp}</td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      Open Server &rarr;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add Environment Modal */}
      <Modal isOpen={isAddEnvOpen} onClose={() => setIsAddEnvOpen(false)} title={`Add Environment to ${project.name}`}>
        <form onSubmit={handleCreateEnv} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Environment Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. EU Production Edge"
              value={envForm.name}
              onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Environment Tier / Type</label>
            <select
              value={envForm.type}
              onChange={(e) => setEnvForm({ ...envForm, type: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Production">Production</option>
              <option value="Staging">Staging</option>
              <option value="Development">Development</option>
              <option value="QA">QA</option>
              <option value="DR">Disaster Recovery (DR)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Cluster / Gateway URL</label>
            <input
              type="text"
              placeholder="https://k8s-cluster.domain.internal"
              value={envForm.clusterUrl}
              onChange={(e) => setEnvForm({ ...envForm, clusterUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsAddEnvOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} leftIcon={<Plus className="w-4 h-4" />}>
              Create Environment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
