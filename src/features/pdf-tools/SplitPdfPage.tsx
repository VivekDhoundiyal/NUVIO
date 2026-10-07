import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Split, Download, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';
import { FileSessionStore } from '../../services/storage/fileSessionStore';

export const SplitPdfPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [splitMode, setSplitMode] = useState<'all' | 'range' | 'chunk'>('all');
  const [rangeInput, setRangeInput] = useState<string>('1-2');
  const [chunkSize, setChunkSize] = useState<number>(2);

  const [isProcessing, setIsProcessing] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [splitResults, setSplitResults] = useState<Array<{ name: string; bytes: Uint8Array }>>([]);

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const info = await PdfEngine.getPdfInfo(uint8, f.name);

      setFile(f);
      setPdfBytes(uint8);
      setTotalPages(info.pages.length);
      setRangeInput(`1-${Math.min(2, info.pages.length)}`);
      await StorageService.logToolUsage('split-pdf');
      toast.success('Document loaded', `${f.name} (${info.pages.length} pages)`);
    } catch (e: any) {
      toast.error('Failed to parse PDF', e.message);
    }
  }, [toast]);

  const hasLoadedSessionRef = useRef(false);

  // Auto-load file from active session
  useEffect(() => {
    if (hasLoadedSessionRef.current) return;
    const active = FileSessionStore.getActiveFile();
    if (active) {
      hasLoadedSessionRef.current = true;
      setTimeout(() => {
        handleFileSelected([active.file]);
      }, 0);
    }
  }, [handleFileSelected]);

  const handleSplit = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);

    try {
      const results: Array<{ name: string; bytes: Uint8Array }> = [];
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (splitMode === 'all') {
        // Split every single page
        const ranges = Array.from({ length: totalPages }, (_, i) => ({ start: i, end: i }));
        const pdfParts = await PdfEngine.splitPdf(pdfBytes, ranges);

        pdfParts.forEach((bytes, idx) => {
          results.push({
            name: `${baseName}-page-${idx + 1}.pdf`,
            bytes,
          });
        });
      } else if (splitMode === 'chunk') {
        // Split every N pages
        const n = Math.max(1, chunkSize);
        const ranges: { start: number; end: number }[] = [];
        for (let i = 0; i < totalPages; i += n) {
          ranges.push({ start: i, end: Math.min(totalPages - 1, i + n - 1) });
        }

        const pdfParts = await PdfEngine.splitPdf(pdfBytes, ranges);
        pdfParts.forEach((bytes, idx) => {
          const startP = ranges[idx].start + 1;
          const endP = ranges[idx].end + 1;
          results.push({
            name: `${baseName}-pages-${startP}${startP !== endP ? `-${endP}` : ''}.pdf`,
            bytes,
          });
        });
      } else {
        // Parse range string: e.g. "1-3, 5"
        const parts = rangeInput.split(',').map((p) => p.trim());
        const ranges: { start: number; end: number }[] = [];

        for (const p of parts) {
          if (p.includes('-')) {
            const [s, e] = p.split('-').map((n) => parseInt(n.trim(), 10));
            if (!isNaN(s) && !isNaN(e)) {
              ranges.push({ start: Math.max(0, s - 1), end: Math.min(totalPages - 1, e - 1) });
            }
          } else {
            const n = parseInt(p, 10);
            if (!isNaN(n)) {
              ranges.push({ start: Math.max(0, n - 1), end: Math.min(totalPages - 1, n - 1) });
            }
          }
        }

        if (ranges.length === 0) {
          toast.warning('Invalid range', 'Please enter a valid page range (e.g. 1-3, 5).');
          setIsProcessing(false);
          return;
        }

        const pdfParts = await PdfEngine.splitPdf(pdfBytes, ranges);
        pdfParts.forEach((bytes, idx) => {
          results.push({
            name: `${baseName}-part-${idx + 1}.pdf`,
            bytes,
          });
        });
      }

      setSplitResults(results);

      // Validate the first split result
      if (results.length > 0) {
        const report = await ValidationEngine.validatePdfOutput(results[0].bytes, {
          operationName: 'Split PDF',
          originalPageCount: totalPages,
          originalSizeBytes: file.size,
        });
        setValidationReport(report);
        setIsModalOpen(true);
      }

      toast.success('Split completed', `Generated ${results.length} document file(s)`);
    } catch (e: any) {
      toast.error('Split failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (splitResults.length === 0) return;

    if (splitResults.length === 1) {
      saveAs(new Blob([splitResults[0].bytes as any], { type: 'application/pdf' }), splitResults[0].name);
      toast.success('Downloaded', splitResults[0].name);
      return;
    }

    // Zip batch
    const zip = new JSZip();
    splitResults.forEach((res) => {
      zip.file(res.name, res.bytes);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `${file ? file.name.replace(/\.pdf$/i, '') : 'split-document'}-archive.zip`;
    saveAs(zipBlob, zipName);
    toast.success('Downloaded ZIP archive', zipName);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Split className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Split PDF</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Extract single pages or custom page ranges into individual PDF files.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Split"
          description="Drag and drop or browse from your device"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {totalPages} pages • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setPdfBytes(null);
                setSplitResults([]);
                FileSessionStore.clear();
              }}
            >
              Change File
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <Tabs
              activeTab={splitMode}
              onChange={(tab) => setSplitMode(tab as any)}
              tabs={[
                { id: 'all', label: 'Split Every Page' },
                { id: 'range', label: 'Custom Range' },
                { id: 'chunk', label: 'Every N Pages' },
              ]}
            />

            {splitMode === 'range' && (
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Page Ranges (Total {totalPages} pages)
                </label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 1-3, 5"
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  Example: "1-2, 4" will create two files: pages 1 to 2, and page 4.
                </span>
              </div>
            )}

            {splitMode === 'chunk' && (
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Split Document into Chunks of N Pages (Total {totalPages} pages)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, totalPages)}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-28 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                  <span className="text-slate-500 text-xs">
                    Will generate {Math.ceil(totalPages / Math.max(1, chunkSize))} separate PDF file(s).
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              isLoading={isProcessing}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              onClick={handleSplit}
            >
              Split & Validate
            </Button>
          </div>

          {splitResults.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Ready: {splitResults.length} output document(s)
              </span>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownloadAll}
              >
                {splitResults.length > 1 ? 'Download All (ZIP)' : 'Download Split PDF'}
              </Button>
            </div>
          )}
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownloadAll}
        downloadLabel={splitResults.length > 1 ? 'Download ZIP Package' : 'Download PDF'}
      />
    </div>
  );
};
