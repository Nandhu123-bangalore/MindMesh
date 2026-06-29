import React from 'react';

interface LoaderProps {
  label?: string;
}

export default function Loader({ label = "Synthesizing vector representations..." }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center p-lg space-y-4 text-center">
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Dynamic ambient pulse gradient */}
        <div className="absolute inset-0 rounded-full border-4 border-primary/10 animate-ping"></div>
        {/* Spin gradient */}
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute w-2 h-2 bg-tertiary rounded-full animate-pulse"></div>
      </div>
      <div>
        <p className="text-xs font-mono tracking-wider uppercase text-primary animate-pulse">{label}</p>
        <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest mt-1">Processing pipeline</p>
      </div>
    </div>
  );
}
