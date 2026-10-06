import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { ScanText, Copy, Download, ShieldCheck, Check } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { OcrEngine } from '../../engines/ocr/ocrEngine';
import { StorageService } from '../../services/storage/db';

export const OcrPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<string>('eng');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [extractedText, setExtractedText] = useState<string>('');
  const [hasCopied, setHasCopied] = useState(false);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setExtractedText('');
    await StorageService.logToolUsage('ocr-pdf');
    toast.success('Document loaded', `${f.name} ready for OCR`);
  };

  const handleRunOcr = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus('Preparing text recognition engine...');

    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const result = await OcrEngine.recognizePdf(uint8, lang, (pct, status) => {
          setProgressPercent(pct);
          setProgressStatus(status);
        });
        text = result.fullText;
      } else {
        text = await OcrEngine.recognizeImage(file, lang, (pct, status) => {
          setProgressPercent(pct);
          setProgressStatus(status);
        });
      }

      setExtractedText(text);
      toast.success('OCR completed', `Extracted ${text.length} characters`);
    } catch (e: any) {
      toast.error('OCR failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setHasCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleDownloadText = () => {
    if (!extractedText || !file) return;
    const base = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${base}-ocr.txt`;
    saveAs(new Blob([extractedText], { type: 'text/plain;charset=utf-8' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <ScanText className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Local OCR & Text Recognition</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Extract text from scanned PDFs and images directly in your browser. Zero server uploads.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
          title="Upload Scanned PDF or Image"
          description="Drag and drop scanned documents or browse from device"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {(file.size / 1024).toFixed(1)} KB • {file.type || 'Document'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setExtractedText('');
              }}
            >
              Change File
            </Button>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Document Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              options={[
                { label: 'English (eng)', value: 'eng' },
                { label: 'Spanish (spa)', value: 'spa' },
                { label: 'French (fra)', value: 'fra' },
                { label: 'German (deu)', value: 'deu' },
              ]}
            />
            <div className="flex flex-col justify-end">
              <Button
                variant="primary"
                size="md"
                isLoading={isProcessing}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleRunOcr}
              >
                Extract Text Locally
              </Button>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Progress value={progressPercent} label={progressStatus} size="md" />
            </div>
          )}

          {/* Results viewer */}
          {extractedText && !isProcessing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Extracted Text ({extractedText.split(/\s+/).filter(Boolean).length} words)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopy}
                  >
                    {hasCopied ? 'Copied' : 'Copy Text'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={handleDownloadText}
                  >
                    Download .txt
                  </Button>
                </div>
              </div>

              <textarea
                readOnly
                value={extractedText}
                rows={12}
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
