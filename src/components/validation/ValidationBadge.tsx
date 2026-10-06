import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import type { ValidationReport } from '../../types/document';

export const ValidationBadge: React.FC<{
  report?: ValidationReport;
  onClick?: () => void;
}> = ({ report, onClick }) => {
  if (!report) return null;

  const hasErrors = report.items.some((item) => item.status === 'failed');
  const hasWarnings = report.items.some((item) => item.status === 'warning');

  let bg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  let Icon = ShieldCheck;
  let text = 'Quality Verified (100%)';

  if (hasErrors) {
    bg = 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800';
    Icon = XCircle;
    text = `Validation Alert (${report.score}%)`;
  } else if (hasWarnings) {
    bg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    Icon = AlertTriangle;
    text = `Quality Notice (${report.score}%)`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all hover:scale-105 ${bg}`}
      title="Click to view automated quality report"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </button>
  );
};
