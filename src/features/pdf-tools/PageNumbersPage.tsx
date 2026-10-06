import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Hash, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

export const PageNumbersPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const [position, setPosition] = useState<
    'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'
  >('bottom-center');
  const [format, setFormat] = useState('Page {n} of {total}');
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(10);

  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      const buffer = await f.arrayBuffer();
      setFile(f);
      setPdfBytes(new Uint8Array(buffer));
      setOutputBytes(null);
      await StorageService.logToolUsage('page-numbers');
      toast.success('Document loaded', f.name);
    } catch (e: any) {
      toast.error('Failed to load file', e.message);
    }
  };

  const handleApply = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);

    try {
      const result = await PdfEngine.addPageNumbers(pdfBytes, {
        position,
        format,
        startNumber,
        fontSize,
      });

      setOutputBytes(result);

      // Automated quality validation
      const report = await ValidationEngine.validatePdfOutput(result, {
        operationName: 'Add Page Numbers',
        originalSizeBytes: file.size,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Page numbers added', 'Paginated document successfully.');
    } catch (e: any) {
      toast.error('Pagination failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBytes || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-numbered.pdf`;
    saveAs(new Blob([outputBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Hash className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Page Numbers</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Add customizable page numbers and running headers/footers across your document.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Number"
          description="Drag and drop or browse from your device"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {(file.size / 1024).toFixed(1)} KB • PDF Document
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setOutputBytes(null);
              }}
            >
              Change File
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <Select
              label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value as any)}
              options={[
                { label: 'Bottom Center (Standard)', value: 'bottom-center' },
                { label: 'Bottom Right', value: 'bottom-right' },
                { label: 'Bottom Left', value: 'bottom-left' },
                { label: 'Top Center', value: 'top-center' },
                { label: 'Top Right', value: 'top-right' },
                { label: 'Top Left', value: 'top-left' },
              ]}
            />

            <Select
              label="Numbering Format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              options={[
                { label: 'Page {n} of {total}', value: 'Page {n} of {total}' },
                { label: '{n} / {total}', value: '{n} / {total}' },
                { label: 'Page {n}', value: 'Page {n}' },
                { label: '{n}', value: '{n}' },
              ]}
            />

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Starting Page Number
              </label>
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Font Size ({fontSize}pt)
              </label>
              <input
                type="range"
                min={8}
                max={16}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-brand-600 mt-2"
              />
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            isLoading={isProcessing}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
            onClick={handleApply}
          >
            Add Page Numbers & Validate
          </Button>
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Numbered PDF"
      />
    </div>
  );
};
