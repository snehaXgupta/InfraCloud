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
      'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-[#eaeaea] border border-transparent shadow-sm font-medium focus:ring-slate-400 dark:focus:ring-white',
    secondary:
      'bg-slate-100 dark:bg-[#141414] hover:bg-slate-200 dark:hover:bg-[#1f1f1f] text-slate-800 dark:text-[#ededed] border border-slate-200 dark:border-[#262626] hover:border-slate-300 dark:hover:border-[#333333]',
    outline:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-700 dark:text-[#ededed] border border-slate-200 dark:border-[#222222] hover:border-slate-300 dark:hover:border-[#333333]',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50 shadow-sm font-medium focus:ring-rose-500',
    ghost:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white',
    success:
      'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/50 shadow-sm font-medium focus:ring-emerald-500',
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
