import React from 'react';
import { Link } from 'react-router-dom';
import { Server, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
          <Server className="w-7 h-7" />
        </div>
        <h1 className="text-4xl font-extrabold text-white font-mono">404</h1>
        <h2 className="text-lg font-bold text-slate-200">Control Plane Endpoint Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested infrastructure route does not exist or has been de-provisioned from the control plane.
        </p>
        <div className="pt-2">
          <Link to="/dashboard">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Overview
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export const UnauthorizedPage = () => {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-600/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-white font-mono">403 Forbidden</h1>
        <h2 className="text-lg font-bold text-slate-200">Insufficient Scoped Permissions</h2>
        <p className="text-xs text-slate-400">
          Your active account role is not authorized to access this scoped infrastructure resource.
        </p>
        <div className="pt-2">
          <Link to="/dashboard">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Overview
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
