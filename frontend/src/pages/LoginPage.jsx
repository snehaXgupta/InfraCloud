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
import api from '../services/api';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const initialRegister = searchParams.get('mode') === 'register' || searchParams.get('signup') === 'true';

  const [isRegisterMode, setIsRegisterMode] = useState(initialRegister);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('DevOps / Infrastructure');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dbStatus, setDbStatus] = useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'register' || params.get('signup') === 'true') {
      setIsRegisterMode(true);
    }
  }, [location.search]);

  const from = location.state?.from?.pathname || '/dashboard';

  React.useEffect(() => {
    let isMounted = true;
    api.get('/health')
      .then((res) => {
        if (!isMounted) return;
        const dbUp = res.data?.dependencies?.database === 'up';
        const lastErr = res.data?.dbDiagnostics?.lastError;
        if (!dbUp) {
          setDbStatus({
            up: false,
            message: lastErr ? `Database disconnected: ${lastErr}` : 'Database is currently offline. Please check your database connection.',
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const errData = err.response?.data;
        if (errData?.dependencies?.database === 'down') {
          const lastErr = errData?.dbDiagnostics?.lastError;
          setDbStatus({
            up: false,
            message: lastErr ? `Database disconnected: ${lastErr}` : 'Database is currently offline.',
          });
        }
      });
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        const res = await register(name, email, password, role);
        if (res?.success) {
          navigate(from, { replace: true });
        } else {
          setErrorMsg(res?.error || 'Registration failed.');
        }
      } else {
        const res = await login(email, password);
        if (res?.success) {
          navigate(from, { replace: true });
        } else {
          setErrorMsg(res?.error || 'Authentication failed. Please check your credentials.');
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
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
    <div className="min-h-screen bg-white dark:bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      {/* Brand Header with Vercel Mark */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <Link to="/" className="inline-flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black border border-slate-300 dark:border-[#2e2e2e] flex items-center justify-center text-white shadow-sm">
            <svg viewBox="0 0 76 65" fill="currentColor" className="w-5 h-5 text-white">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
            SPACES PANEL
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
          {isRegisterMode ? 'Create Platform Account' : 'Sign in to Control Plane'}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-[#888888]">
          {isRegisterMode
            ? 'Set up credentials for scoped infrastructure access'
            : 'Enter your credentials to access managed server fleets'}
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] py-8 px-6 sm:px-8 shadow-2xl rounded-xl relative">
          {dbStatus && !dbStatus.up && (
            <div className="mb-5 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>{dbStatus.message}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#111111] rounded-lg mb-6 border border-slate-200 dark:border-[#222222]">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                !isRegisterMode
                  ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(true);
                setErrorMsg('');
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                isRegisterMode
                  ? 'bg-white dark:bg-[#222222] text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegisterMode && (
              <div>
                <label className="block text-[11px] font-medium uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#555] focus:outline-none focus:border-slate-500 dark:focus:border-white transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#555] focus:outline-none focus:border-slate-500 dark:focus:border-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-[#666] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#555] focus:outline-none focus:border-slate-500 dark:focus:border-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-[#666] dark:hover:text-[#aaa]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-[11px] font-medium uppercase font-mono tracking-wider text-slate-500 dark:text-[#888888] mb-1">
                  Initial Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-[#222222] rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-500 dark:focus:border-white"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 mt-2 rounded-md bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <span>{isRegisterMode ? 'Register Account' : 'Authenticate & Enter'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Register/Login */}
          <div className="mt-5 text-center text-xs text-slate-500 dark:text-[#888888]">
            {isRegisterMode ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setErrorMsg('');
                  }}
                  className="text-slate-900 dark:text-white font-medium hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setErrorMsg('');
                  }}
                  className="text-slate-900 dark:text-white font-medium hover:underline cursor-pointer"
                >
                  Create one
                </button>
              </span>
            )}
          </div>

          {/* Quick Demo Seed Logins */}
          {(import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true') && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#1f1f1f]">
              <p className="text-[10px] font-mono text-slate-400 dark:text-[#666] uppercase tracking-wider mb-2.5 text-center">
                1-Click Demo Logins
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillQuickLogin('admin@example.com', 'Admin@123')}
                  className="p-2 rounded-md bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-[#333] text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-slate-900 dark:text-white truncate">Platform Admin</div>
                  <div className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">admin@example.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickLogin('devops@example.com', 'DevOps@123')}
                  className="p-2 rounded-md bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-[#333] text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-slate-900 dark:text-white truncate">DevOps SRE Lead</div>
                  <div className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">devops@example.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickLogin('auditor@example.com', 'Auditor@123')}
                  className="p-2 rounded-md bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-[#333] text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-slate-900 dark:text-white truncate">Auditor</div>
                  <div className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">auditor@example.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickLogin('client.admin@example.com', 'Client@123')}
                  className="p-2 rounded-md bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-[#333] text-left transition-colors cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-slate-900 dark:text-white truncate">Client Admin</div>
                  <div className="text-[10px] text-slate-400 dark:text-[#666] font-mono truncate">client.admin@...</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
