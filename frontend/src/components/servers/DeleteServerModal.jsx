import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const DeleteServerModal = ({ isOpen, server, onClose, onServerDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { success, error: showError } = useToast();

  const handleDelete = async () => {
    if (!server?._id) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/servers/${server._id}`);
      if (res.data?.success) {
        success(`Droplet '${server.name}' destroyed successfully`);
        if (onServerDeleted) onServerDeleted(server._id);
        onClose();
      }
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to destroy server');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Destroy Droplet Instance"
      subtitle="This action is permanent and cannot be undone."
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            Are you sure you want to permanently delete{' '}
            <strong className="text-white font-mono">{server?.name}</strong> (
            <span className="font-mono text-slate-400">{server?.network?.publicIp}</span>)? All telemetry and attached logs will be removed.
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Destroy Server
          </Button>
        </div>
      </div>
    </Modal>
  );
};
