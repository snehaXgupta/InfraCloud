import React from 'react';

export const Card = ({
  children,
  className = '',
  hoverEffect = false,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1f1f1f] shadow-sm transition-all duration-200 ${
        hoverEffect ? 'hover:border-slate-300 dark:hover:border-[#333333] hover:shadow-md cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', action, title, subtitle }) => {
  return (
    <div className={`p-4 md:p-5 border-b border-slate-100 dark:border-[#1f1f1f] flex items-center justify-between gap-4 ${className}`}>
      <div>
        {title && <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white">{title}</h3>}
        {subtitle && <p className="text-xs text-slate-500 dark:text-[#888888] mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return <div className={`p-4 md:p-5 ${className}`}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return <div className={`p-4 bg-slate-50 dark:bg-[#050505] border-t border-slate-100 dark:border-[#1f1f1f] rounded-b-xl ${className}`}>{children}</div>;
};
