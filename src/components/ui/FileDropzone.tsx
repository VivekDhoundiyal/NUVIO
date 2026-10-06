import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string; // e.g. ".pdf,application/pdf"
  multiple?: boolean;
  maxSizeBytes?: number; // default: 100MB
  title?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  accept = '.pdf,application/pdf',
  multiple = false,
  maxSizeBytes = 100 * 1024 * 1024, // 100 MB warning limit
  title = 'Drag & drop your files here',
  description = 'or click to browse from your device',
  className,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    setWarning(null);

    const validFiles: File[] = [];
    let hasLargeFile = false;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > maxSizeBytes) {
        hasLargeFile = true;
      }
      validFiles.push(file);
    }

    if (hasLargeFile) {
      setWarning(
        `One or more files exceed ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB. Browser memory processing may take longer.`
      );
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!disabled && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={title}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={twMerge(
          clsx(
            'relative flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none',
            isDragOver
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 scale-[1.01] shadow-elevated'
              : 'border-paper-300 dark:border-ink-800 hover:border-brand-500 dark:hover:border-brand-500 bg-paper-50/80 dark:bg-ink-900/40 hover:bg-paper-50 dark:hover:bg-ink-900/70 shadow-subtle',
            disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
            className
          )
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset input value so same file can be selected again
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3.5">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-subtle transition-transform group-hover:scale-105">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink-950 dark:text-ink-50">{title}</h3>
            <p className="text-xs text-ink-600 dark:text-ink-300 mt-1 max-w-sm">{description}</p>
          </div>
          <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-paper-200/70 dark:bg-ink-800 text-[11px] text-ink-700 dark:text-ink-300 font-mono">
            <File className="w-3.5 h-3.5" />
            <span>Accepted: {accept.replace(/application\/[a-z.-]+/g, '').replace(/,/g, ' ')}</span>
          </div>
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
};
