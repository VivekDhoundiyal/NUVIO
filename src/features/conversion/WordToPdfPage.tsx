import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { FileCheck, ShieldCheck, Download, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { WordToPdfEngine } from '../../engines/conversion/wordToPdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

export const WordToPdfPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);

  const [isConverting, setIsConverting] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      setFile(f);
      setDocxBuffer(buffer);
      setPdfBytes(null);
      await StorageService.logToolUsage('word-to-pdf');
      toast.success('Word document loaded', `${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      toast.error('Failed to load Word document', e.message);
    }
  };

  const handleConvert = async () => {
    if (!docxBuffer || !file) return;
    setIsConverting(true);
    setProgressPercent(15);
    setProgressStatus('Extracting OpenXML elements...');

    try {
      const generatedPdf = await WordToPdfEngine.convertDocxToPdf(docxBuffer, (pct, msg) => {
        setProgressPercent(pct);
        setProgressStatus(msg);
      });

      setPdfBytes(generatedPdf);

      // Validate output PDF
      const report = await ValidationEngine.validatePdfOutput(generatedPdf, {
        operationName: 'Word to PDF',
        originalSizeBytes: file.size,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Conversion complete', 'Converted Word document to PDF');
    } catch (e: any) {
      toast.error('Conversion failed', e.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytes || !file) return;
    const base = file.name.replace(/\.docx?$/i, '');
    const outName = `${base}.pdf`;
    saveAs(new Blob([pdfBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <FileCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Word to PDF</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Convert Microsoft Word (.docx) files into standard, high-fidelity PDF documents directly in your browser.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          title="Upload Word Document to Convert"
          description="Drag and drop .docx files or click to browse"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {(file.size / 1024).toFixed(1)} KB • Word Document
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setDocxBuffer(null);
                setPdfBytes(null);
              }}
            >
              Change File
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Format:</span>
              <span className="font-mono text-slate-500">DOCX → Standard PDF (A4)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Local Typesetting</span>
            </div>
          </div>

          {/* Progress */}
          {isConverting && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Progress value={progressPercent} label={progressStatus} size="md" />
            </div>
          )}

          {/* Results card */}
          {pdfBytes && !isConverting && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    PDF Successfully Generated
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {(pdfBytes.byteLength / 1024).toFixed(1)} KB • Standard PDF
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download PDF
              </Button>
            </div>
          )}

          {!isConverting && !pdfBytes && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleConvert}
            >
              Convert to PDF Document
            </Button>
          )}
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Generated PDF"
      />
    </div>
  );
};
