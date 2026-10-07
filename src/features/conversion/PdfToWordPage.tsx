import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Download, ArrowRight, CheckCircle2, ScanText, AlertCircle } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { PdfToWordEngine } from '../../engines/conversion/pdfToWordEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';
import { FileSessionStore } from '../../services/storage/fileSessionStore';

export const PdfToWordPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isScannedDoc, setIsScannedDoc] = useState<boolean>(false);

  const [isConverting, setIsConverting] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [docxBytes, setDocxBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const info = await PdfEngine.getPdfInfo(uint8, f.name);

      setFile(f);
      setPdfBytes(uint8);
      setPageCount(info.pages.length);
      setDocxBytes(null);

      // Inspect whether document is scanned (no selectable vector text)
      try {
        const docProxy = await PdfEngine.loadPdfJsDoc(uint8);
        const { isScanned } = await PdfEngine.extractPageTextSpans(docProxy, 1);
        setIsScannedDoc(isScanned);
      } catch {
        setIsScannedDoc(false);
      }

      await StorageService.logToolUsage('pdf-to-word');
      toast.success('PDF loaded', `${f.name} (${info.pages.length} pages)`);
    } catch (e: any) {
      toast.error('Failed to parse PDF', e.message);
    }
  }, [toast]);

  const hasLoadedSessionRef = useRef(false);

  // Auto-load active file from session store if navigated from upload arena
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

  const handleConvert = async () => {
    if (!pdfBytes || !file) return;
    setIsConverting(true);
    setProgressPercent(10);
    setProgressStatus('Analyzing PDF layout and font elements...');

    try {
      const generatedDocx = await PdfToWordEngine.convertPdfToDocx(pdfBytes, (pct, msg) => {
        setProgressPercent(pct);
        setProgressStatus(msg);
      });

      setDocxBytes(generatedDocx);

      // Validate output
      const report = ValidationEngine.validateDocxOutput(generatedDocx, {
        originalPageCount: pageCount,
        originalSizeBytes: file.size,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Conversion complete', 'Converted PDF to editable Word document (.docx)');
    } catch (e: any) {
      toast.error('Conversion failed', e.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!docxBytes || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}.docx`;
    saveAs(
      new Blob([docxBytes as any], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      outName
    );
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">PDF to Word</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Convert PDF documents into editable Microsoft Word (.docx) files locally with layout fidelity.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Convert"
          description="Drag and drop or browse from your device"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {pageCount} page(s) • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setPdfBytes(null);
                setDocxBytes(null);
                FileSessionStore.clear();
              }}
            >
              Change File
            </Button>
          </div>

          {/* Scanned document banner if detected */}
          {isScannedDoc && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  Scanned Document Detected
                </span>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  This PDF appears to contain raster scans without embedded text. You can still convert it directly, or run on-device Local OCR to extract searchable text first.
                </p>
                <div className="mt-2.5">
                  <Link
                    to="/ocr-pdf"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors"
                  >
                    <ScanText className="w-3.5 h-3.5" />
                    Open in Local OCR
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Workflow card */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Format:</span>
              <span className="font-mono text-slate-500">PDF → DOCX</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Client-Side OpenXML</span>
            </div>
          </div>

          {/* Progress */}
          {isConverting && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Progress value={progressPercent} label={progressStatus} size="md" />
            </div>
          )}

          {/* Results card */}
          {docxBytes && !isConverting && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    DOCX Successfully Generated
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {(docxBytes.byteLength / 1024).toFixed(1)} KB • OpenXML Document
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download DOCX
              </Button>
            </div>
          )}

          {!isConverting && !docxBytes && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleConvert}
            >
              Convert to Editable Word Document
            </Button>
          )}
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Word (.docx)"
      />
    </div>
  );
};
