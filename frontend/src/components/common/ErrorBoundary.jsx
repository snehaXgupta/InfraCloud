import React from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Something went wrong</h2>
              <p className="text-xs text-slate-500 dark:text-[#888888] mt-1 font-mono">
                {this.state.error?.message || 'An unexpected rendering error occurred'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.href = '/servers'}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#222222] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Servers</span>
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-slate-800 dark:hover:bg-[#eaeaea] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
