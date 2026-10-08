import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Server,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  User,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('DevOps / Infrastructure');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const res = await register(name, email, password, role);
        if (res?.success) {
          navigate(from, { replace: true });
        }
      } else {
        const res = await login(email, password);
        if (res?.success) {
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      setErrorMsg('Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickLogin = (quickEmail, quickPass) => {
    setIsRegisterMode(false);
    setEmail(quickEmail);
    setPassword(quickPass);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-blue-600/30 selection:text-blue-200">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <Link to="/" className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-mono font-bold shadow-lg shadow-blue-600/20">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">InfraControl</span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold text-white tracking-tight">
          {isRegisterMode ? 'Create Platform Account' : 'Sign in to Control Plane'}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {isRegisterMode
            ? 'Set up credentials for scoped infrastructure access'
            : 'Enter your credentials to access managed server fleets'}
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-[#0d131f] border border-slate-800 py-8 px-6 sm:px-8 shadow-2xl rounded-2xl relative">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-slate-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold uppercase font-mono tracking-wider text-slate-400 mb-1">
                  Initial Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="Platform Admin">Platform Admin</option>
                  <option value="DevOps / Infrastructure">DevOps / Infrastructure</option>
                  <option value="Project Admin">Project Admin</option>
                  <option value="Client Admin">Client Admin</option>
                  <option value="Client Viewer">Client Viewer</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-2.5 mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isRegisterMode ? 'Register Account' : 'Authenticate & Enter'}
            </Button>
          </form>

          {/* Toggle Register/Login */}
          <div className="mt-5 text-center text-xs text-slate-400">
            {isRegisterMode ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(false)}
                  className="text-blue-400 font-semibold hover:underline"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(true)}
                  className="text-blue-400 font-semibold hover:underline"
                >
                  Create one
                </button>
              </span>
            )}
          </div>

          {/* Quick Demo Seed Logins */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              1-Click Dev Seed Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillQuickLogin('admin@example.com', 'Admin@123')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-white truncate">Platform Admin</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">admin@example.com</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('devops@example.com', 'DevOps@123')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-white truncate">DevOps SRE Lead</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">devops@example.com</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('auditor@example.com', 'Auditor@123')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-white truncate">Auditor</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">auditor@example.com</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickLogin('client.admin@example.com', 'Client@123')}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-white truncate">Client Admin</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">client.admin@...</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
