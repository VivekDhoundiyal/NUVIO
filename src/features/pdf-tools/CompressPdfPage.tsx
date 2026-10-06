import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Minimize2, ShieldCheck, Download, TrendingDown } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { CompressionEngine } from '../../engines/compression/compressionEngine';
import type { CompressionLevel, CompressionResult } from '../../engines/compression/compressionEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

export const CompressPdfPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const [level, setLevel] = useState<CompressionLevel>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [result, setResult] = useState<CompressionResult | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      setFile(f);
      setPdfBytes(new Uint8Array(buffer));
      setResult(null);
      await StorageService.logToolUsage('compress-pdf');
      toast.success('Document loaded', `${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      toast.error('Failed to load file', e.message);
    }
  };

  const handleCompress = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus('Starting optimization...');

    try {
      const compResult = await CompressionEngine.compressPdf(
        pdfBytes,
        level,
        (percent, msg) => {
          setProgressPercent(percent);
          setProgressStatus(msg);
        }
      );

      setResult(compResult);

      // Validate output
      const report = await ValidationEngine.validatePdfOutput(compResult.pdfBytes, {
        operationName: 'Compress PDF',
        originalSizeBytes: compResult.originalSizeBytes,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success(
        'Compression complete',
        `Reduced file by ${compResult.percentageReduced}% (${(compResult.savedBytes / 1024).toFixed(1)} KB saved)`
      );
    } catch (e: any) {
      toast.error('Compression failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-compressed.pdf`;
    saveAs(new Blob([result.pdfBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  const levels: { id: CompressionLevel; title: string; desc: string }[] = [
    { id: 'low', title: 'Low Compression', desc: 'Highest visual fidelity, slight size reduction.' },
    { id: 'medium', title: 'Recommended', desc: 'Optimal balance of clear legibility and file size.' },
    { id: 'high', title: 'High Compression', desc: 'Smallest file size, useful for email attachments.' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Minimize2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Compress PDF</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Reduce PDF file size directly in your browser. Honest byte savings without sending files anywhere.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Compress"
          description="Drag and drop or browse from your device"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Original Size: {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setPdfBytes(null);
                setResult(null);
              }}
            >
              Change File
            </Button>
          </div>

          {/* Preset selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {levels.map((lvl) => {
              const isSelected = level === lvl.id;
              return (
                <div
                  key={lvl.id}
                  onClick={() => setLevel(lvl.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-1 ring-brand-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {lvl.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{lvl.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Progress value={progressPercent} label={progressStatus} size="md" />
            </div>
          )}

          {/* Results Metric Card */}
          {result && !isProcessing && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Optimization Succeeded: {result.percentageReduced}% Saved
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Reduced from {(result.originalSizeBytes / 1024).toFixed(1)} KB to{' '}
                    {(result.compressedSizeBytes / 1024).toFixed(1)} KB (
                    {(result.savedBytes / 1024).toFixed(1)} KB saved)
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download
              </Button>
            </div>
          )}

          {!isProcessing && !result && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              onClick={handleCompress}
            >
              Compress & Optimize Document
            </Button>
          )}
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Optimized PDF"
      />
    </div>
  );
};
