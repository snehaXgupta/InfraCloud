import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 border border-blue-500/50 focus:ring-blue-500',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-600 focus:ring-slate-500',
    outline:
      'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 focus:ring-slate-600',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 border border-rose-500/50 focus:ring-rose-500',
    ghost:
      'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-100 focus:ring-slate-700',
    success:
      'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 border border-emerald-500/50 focus:ring-emerald-500',
  };

  const sizes = {
    xs: 'text-xs px-2.5 py-1.5 gap-1.5',
    sm: 'text-xs px-3 py-2 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
