import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProgressProps {
  value?: number; // 0 to 100. If undefined, renders honest indeterminate bar
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  label,
  sublabel,
  size = 'md',
  className,
}) => {
  const isIndeterminate = value === undefined || value === null;
  const clampedValue = isIndeterminate ? 0 : Math.min(100, Math.max(0, value));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={twMerge('w-full flex flex-col gap-1.5', className)}>
      {(label || !isIndeterminate) && (
        <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
          <span>{label}</span>
          {!isIndeterminate && <span className="font-mono text-slate-500">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : Math.round(clampedValue)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Operation progress'}
        className={twMerge(
          'w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative',
          heights[size]
        )}
      >
        {isIndeterminate ? (
          <div className="h-full bg-brand-600 rounded-full w-2/5 animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />
        ) : (
          <div
            className="h-full bg-brand-600 dark:bg-brand-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedValue}%` }}
          />
        )}
      </div>
      {sublabel && <span className="text-[11px] text-slate-500 dark:text-slate-400">{sublabel}</span>}
    </div>
  );
};
