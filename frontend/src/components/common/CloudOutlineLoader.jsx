import React from 'react';

/**
 * CloudOutlineLoader
 * Draws and completes a geometric cloud perimeter stroke during page/telemetry loads.
 */
export const CloudOutlineLoader = ({
  size = 'md',
  className = '',
  once = false,
}) => {
  const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div className={`relative inline-flex items-center justify-center ${dim} ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-slate-900 dark:text-white"
      >
        {/* Background outline track */}
        <path
          d="M18 46h28a11 11 0 0 0 3.2-21.5 15 15 0 0 0-29.4 3.7A9.5 9.5 0 0 0 18 46z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-15"
        />

        {/* Animated completing outline */}
        <path
          pathLength="100"
          d="M18 46h28a11 11 0 0 0 3.2-21.5 15 15 0 0 0-29.4 3.7A9.5 9.5 0 0 0 18 46z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={once ? 'animate-cloud-draw-once' : 'animate-cloud-draw'}
        />
      </svg>
    </div>
  );
};

export default CloudOutlineLoader;
