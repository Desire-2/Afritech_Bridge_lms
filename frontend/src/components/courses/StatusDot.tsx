import React from 'react';

export const StatusDot: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => {
  const cls = status === 'open' 
    ? 'bg-emerald-500' 
    : status === 'upcoming' 
    ? 'bg-sky-500' 
    : 'bg-zinc-400';
  return <span className={`w-2 h-2 rounded-full ${cls} shrink-0 ${className}`} />;
};
