import React from 'react';
import { Database } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { CloudOutlineLoader } from './CloudOutlineLoader';

export const LoadingSpinner = ({ label = 'Loading telemetry data...', fullPage = false }) => {
  if (fullPage) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
        <div className="relative flex items-center justify-center mb-3">
          <CloudOutlineLoader size="lg" showCenterIcon />
        </div>
        <p className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400 tracking-wider animate-pulse uppercase">
          {label}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5 p-6 text-slate-500 dark:text-zinc-400">
      <CloudOutlineLoader size="xs" />
      <span className="text-xs font-mono font-medium">{label}</span>
    </div>
  );
};

export const EmptyState = ({
  icon: Icon = Database,
  title = 'No records found',
  description = 'There is currently no telemetry or data matching your filters.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/20">
      <div className="inline-flex p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this operation?',
  confirmLabel = 'Confirm',
  variant = 'danger',
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-xl border shrink-0 ${
            variant === 'danger'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
