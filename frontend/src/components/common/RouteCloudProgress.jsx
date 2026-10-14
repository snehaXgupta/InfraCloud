import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CloudOutlineLoader } from './CloudOutlineLoader';

/**
 * RouteCloudProgress
 * Displays an elegant top-edge completing cloud stroke whenever navigating between pages.
 */
export const RouteCloudProgress = () => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset and trigger transition animation on route change
    setActive(true);
    setProgress(30);

    const step1 = setTimeout(() => {
      setProgress(75);
    }, 150);

    const step2 = setTimeout(() => {
      setProgress(100);
    }, 350);

    const step3 = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 650);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, [location.pathname, location.search]);

  if (!active && progress === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] pointer-events-none transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Top Hairline Progress Stream */}
      <div className="h-[2px] w-full bg-transparent overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-transparent via-slate-900 to-slate-900 dark:via-white dark:to-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Floating Completing Cloud Token on Top-Right */}
      <div className="absolute top-2 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/90 border border-slate-200 dark:border-zinc-800 shadow-lg backdrop-blur-md">
        <CloudOutlineLoader size="xs" once />
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-semibold">
          {progress < 100 ? 'Syncing...' : 'Loaded'}
        </span>
      </div>
    </div>
  );
};

export default RouteCloudProgress;
