import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Files, ArrowUp, ArrowDown, Trash2, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

interface FileToMerge {
  id: string;
  file: File;
  pageCount?: number;
  buffer: Uint8Array;
}

export const MergePdfPage: React.FC = () => {
  const toast = useToast();
  const [files, setFiles] = useState<FileToMerge[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedPdfBytes, setMergedPdfBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFilesSelected = async (newFiles: File[]) => {
    try {
      const added: FileToMerge[] = [];
      for (const file of newFiles) {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        let pageCount = 1;
        try {
          const info = await PdfEngine.getPdfInfo(uint8, file.name);
          pageCount = info.pages.length;
        } catch {
          // ignore
        }
        added.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          pageCount,
          buffer: uint8,
        });
      }
      setFiles((prev) => [...prev, ...added]);
      await StorageService.logToolUsage('merge-pdf');
      toast.success('Added files', `${newFiles.length} PDF(s) added to merge queue`);
    } catch (e: any) {
      toast.error('Failed to parse file', e.message);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= files.length) return;
    const newFiles = [...files];
    const [moved] = newFiles.splice(index, 1);
    newFiles.splice(targetIdx, 0, moved);
    setFiles(newFiles);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.warning('Need at least 2 files', 'Please upload at least 2 PDF documents to merge.');
      return;
    }

    setIsProcessing(true);
    try {
      const totalExpectedPages = files.reduce((acc, f) => acc + (f.pageCount || 0), 0);
      const totalOriginalBytes = files.reduce((acc, f) => acc + f.file.size, 0);

      const buffers = files.map((f) => f.buffer);
      const mergedBytes = await PdfEngine.mergePdfs(buffers);
      setMergedPdfBytes(mergedBytes);

      // Automated quality validation
      const report = await ValidationEngine.validatePdfOutput(mergedBytes, {
        expectedPageCount: totalExpectedPages,
        operationName: 'Merge PDF',
        originalPageCount: totalExpectedPages,
        originalSizeBytes: totalOriginalBytes,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Merge successful', `Combined ${files.length} documents into ${totalExpectedPages} pages`);
    } catch (e: any) {
      toast.error('Merge failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!mergedPdfBytes) return;
    const outName = 'merged-document.pdf';
    saveAs(new Blob([mergedPdfBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Files className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Merge PDF Files</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Combine multiple PDF files into one clean document. Reorder pages freely before merging. 100% private.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          accept=".pdf,application/pdf"
          multiple={true}
          title="Upload PDF Files to Merge"
          description="Drag multiple PDFs or click to add files"
        />

        {files.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-subtle">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Documents to Combine ({files.length} files • {totalPages} total pages)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-xs text-red-600 dark:text-red-400"
              >
                Clear All
              </Button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {files.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold flex items-center justify-center text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.pageCount} page(s) • {(item.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <IconButton
                      size="sm"
                      disabled={idx === 0}
                      aria-label="Move file up"
                      onClick={() => moveItem(idx, 'up')}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      disabled={idx === files.length - 1}
                      aria-label="Move file down"
                      onClick={() => moveItem(idx, 'down')}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="danger"
                      aria-label="Remove file"
                      onClick={() => removeFile(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/20">
              <Button
                variant="primary"
                size="md"
                isLoading={isProcessing}
                disabled={files.length < 2}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleMerge}
              >
                Merge & Validate PDFs
              </Button>
            </div>
          </div>
        )}
      </div>

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Merged PDF"
      />
    </div>
  );
};
