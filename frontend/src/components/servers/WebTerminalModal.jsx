import React from 'react';
import { Modal } from '../common/Modal';
import { WebTerminalConsole } from './WebTerminalConsole';

export const WebTerminalModal = ({ isOpen, server, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`SSH Web Terminal — ${server?.name || 'Droplet'}`}
      subtitle={`Connected to ${server?.hostname || server?.network?.publicIp || '127.0.0.1'}`}
      maxWidth="max-w-5xl"
    >
      <div className="mt-2">
        <WebTerminalConsole server={server} height="520px" />
      </div>
    </Modal>
  );
};
