import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Download, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { ValidationReport } from '../../types/document';

export interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: ValidationReport;
  onConfirmDownload?: () => void;
  downloadLabel?: string;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  report,
  onConfirmDownload,
  downloadLabel = 'Download Document',
}) => {
  if (!report) return null;

  const hasFailures = report.items.some((i) => i.status === 'failed');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Document Quality Report"
      description="DocuLoom validates every generated document by reopening and analyzing output fidelity."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Validated at {new Date(report.timestamp).toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onConfirmDownload && (
              <Button
                variant={hasFailures ? 'danger' : 'primary'}
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => {
                  onClose();
                  onConfirmDownload();
                }}
              >
                {downloadLabel}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Score Card */}
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border ${
            hasFailures
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
              : report.score === 100
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              hasFailures
                ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                : report.score === 100
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300'
            }`}
          >
            {hasFailures ? (
              <XCircle className="w-6 h-6" />
            ) : report.score === 100 ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {hasFailures
                ? 'Validation Issues Detected'
                : report.score === 100
                ? 'Document Quality 100% Verified'
                : 'Document Quality Notice'}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {hasFailures
                ? 'One or more automated fidelity checks failed. Please review the details below.'
                : 'All critical structure and fidelity verification checks passed without errors.'}
            </p>
          </div>
          <div className="ml-auto text-right">
            <span className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-200">
              {report.score}%
            </span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Fidelity Score
            </span>
          </div>
        </div>

        {/* Input vs Output comparison */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div>
            <span className="font-semibold text-slate-500 uppercase text-[10px] block">Input Document</span>
            <div className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
              <div>Pages: <span className="font-mono font-medium">{report.inputSummary.pageCount ?? 'N/A'}</span></div>
              <div>Size: <span className="font-mono font-medium">{report.inputSummary.fileSizeBytes ? `${(report.inputSummary.fileSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}</span></div>
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase text-[10px] block">Output Document</span>
            <div className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
              <div>Pages: <span className="font-mono font-medium">{report.outputSummary.pageCount ?? 'N/A'}</span></div>
              <div>Size: <span className="font-mono font-medium">{report.outputSummary.fileSizeBytes ? `${(report.outputSummary.fileSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}</span></div>
            </div>
          </div>
        </div>

        {/* Validation Checklist Items */}
        <div className="space-y-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Automated Inspection Checks
          </h5>
          <div className="space-y-2">
            {report.items.map((item) => {
              const statusIcons = {
                passed: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
                warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
                failed: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
              };

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 text-xs"
                >
                  <div className="mt-0.5">{statusIcons[item.status]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.status === 'passed'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : item.status === 'warning'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.details}
                    </p>
                    {item.suggestedAction && (
                      <p className="text-slate-500 dark:text-slate-500 mt-1 font-mono text-[11px]">
                        Suggestion: {item.suggestedAction}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
