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
      className={`rounded-xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#212636] shadow-sm transition-all duration-200 ${
        hoverEffect ? 'hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', action, title, subtitle }) => {
  return (
    <div className={`p-4 md:p-5 border-b border-slate-100 dark:border-[#1c202c] flex items-center justify-between gap-4 ${className}`}>
      <div>
        {title && <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">{title}</h3>}
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
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
  return <div className={`p-4 bg-slate-50 dark:bg-[#0d0f15] border-t border-slate-100 dark:border-[#1c202c] rounded-b-xl ${className}`}>{children}</div>;
};
