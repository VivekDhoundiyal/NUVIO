import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Image as ImageIcon, Download, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { ImageEngine } from '../../engines/image/imageEngine';
import { StorageService } from '../../services/storage/db';

export const PdfToImagesPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [dpi, setDpi] = useState<number>(150);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number | undefined>(undefined);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const [renderedImages, setRenderedImages] = useState<Array<{ pageNumber: number; blob: Blob; dataUrl: string }>>([]);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      setFile(f);
      setPdfBytes(new Uint8Array(buffer));
      setRenderedImages([]);
      await StorageService.logToolUsage('pdf-to-images');
      toast.success('PDF loaded', `${f.name} ready for image export`);
    } catch (e: any) {
      toast.error('Failed to load PDF', e.message);
    }
  };

  const handleRender = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus('Starting page rendering...');

    try {
      const results = await ImageEngine.renderPdfToImages(
        pdfBytes,
        {
          format,
          dpi,
        },
        (pct, msg) => {
          setProgressPercent(pct);
          setProgressStatus(msg);
        }
      );

      setRenderedImages(results);
      toast.success('Render complete', `Generated ${results.length} image(s)`);
    } catch (e: any) {
      toast.error('Rendering failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = (index: number) => {
    const img = renderedImages[index];
    if (!img || !file) return;
    const ext = format === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-page-${img.pageNumber}.${ext}`;
    saveAs(img.blob, outName);
    toast.success('Downloaded image', outName);
  };

  const handleDownloadAllZip = async () => {
    if (renderedImages.length === 0 || !file) return;
    const zip = new JSZip();
    const ext = format === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.pdf$/i, '');

    renderedImages.forEach((img) => {
      zip.file(`${base}-page-${img.pageNumber}.${ext}`, img.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `${base}-images.zip`;
    saveAs(zipBlob, zipName);
    toast.success('Downloaded ZIP', zipName);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <ImageIcon className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">PDF to Images</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Render PDF pages into high-resolution PNG or JPEG images with selectable DPI quality.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Convert to Images"
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
                setRenderedImages([]);
              }}
            >
              Change File
            </Button>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Image Format"
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              options={[
                { label: 'PNG (Lossless & Crisp)', value: 'image/png' },
                { label: 'JPEG (Compact Size)', value: 'image/jpeg' },
              ]}
            />
            <Select
              label="Resolution Quality"
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              options={[
                { label: 'Standard (72 DPI)', value: 72 },
                { label: 'Balanced (150 DPI - Recommended)', value: 150 },
                { label: 'High Resolution (300 DPI)', value: 300 },
              ]}
            />
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <Progress value={progressPercent} label={progressStatus} size="md" />
            </div>
          )}

          {!isProcessing && renderedImages.length === 0 && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              onClick={handleRender}
            >
              Render PDF to Images
            </Button>
          )}

          {/* Rendered images grid */}
          {renderedImages.length > 0 && !isProcessing && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rendered Pages ({renderedImages.length})
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadAllZip}
                >
                  Download All (ZIP)
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {renderedImages.map((img, idx) => (
                  <div
                    key={img.pageNumber}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50 dark:bg-slate-950 flex flex-col items-center gap-2"
                  >
                    <div className="w-full aspect-[1/1.4] bg-white rounded overflow-hidden flex items-center justify-center border">
                      <img src={img.dataUrl} alt={`Page ${img.pageNumber}`} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex items-center justify-between w-full text-xs">
                      <span className="font-mono text-[11px] text-slate-500">#{img.pageNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(idx)}
                        className="text-brand-600 hover:text-brand-700 text-xs font-semibold"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
