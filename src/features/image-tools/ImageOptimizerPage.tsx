import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Sliders, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/useToast';
import { ImageEngine } from '../../engines/image/imageEngine';
import { StorageService } from '../../services/storage/db';

export const ImageOptimizerPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);

  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [format, setFormat] = useState<'image/webp' | 'image/png' | 'image/jpeg'>('image/webp');
  const [quality, setQuality] = useState<number>(0.85);

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; dataUrl: string; width: number; height: number } | null>(null);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
      setTargetWidth(img.width);
      setTargetHeight(img.height);
      setFile(f);
      setResult(null);
    };
    img.src = objectUrl;

    await StorageService.logToolUsage('image-optimizer');
    toast.success('Image loaded', f.name);
  };

  const handleWidthChange = (val: number) => {
    setTargetWidth(val);
    if (lockAspect && originalWidth > 0) {
      setTargetHeight(Math.round(val * (originalHeight / originalWidth)));
    }
  };

  const handleHeightChange = (val: number) => {
    setTargetHeight(val);
    if (lockAspect && originalHeight > 0) {
      setTargetWidth(Math.round(val * (originalWidth / originalHeight)));
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const processed = await ImageEngine.processImage(file, {
        width: targetWidth,
        height: targetHeight,
        format,
        quality,
      });

      setResult(processed);
      toast.success(
        'Optimization complete',
        `${(processed.blob.size / 1024).toFixed(1)} KB (${processed.width}x${processed.height}px)`
      );
    } catch (e: any) {
      toast.error('Processing failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !file) return;
    const ext = format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${base}-optimized.${ext}`;
    saveAs(result.blob, outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Image Studio</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Resize dimensions, convert file formats, and optimize image size directly in your browser.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          title="Upload Image to Optimize"
          description="Drag and drop PNG, JPG, or WebP images"
        />
      ) : (
        <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {originalWidth}x{originalHeight}px • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
            >
              Change File
            </Button>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Width (px)</label>
              <input
                type="number"
                value={targetWidth}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Height (px)</label>
              <input
                type="number"
                value={targetHeight}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => setLockAspect(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span>Maintain aspect ratio</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Export Format"
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              options={[
                { label: 'WebP (Modern & Compact)', value: 'image/webp' },
                { label: 'PNG (Lossless Quality)', value: 'image/png' },
                { label: 'JPEG (Universal)', value: 'image/jpeg' },
              ]}
            />
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-brand-600 mt-2"
              />
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            isLoading={isProcessing}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
            onClick={handleProcess}
          >
            Process & Optimize Image
          </Button>

          {/* Result view */}
          {result && !isProcessing && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Image Optimized ({result.width}x{result.height}px)
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Original: {(file.size / 1024).toFixed(1)} KB → Result:{' '}
                    {(result.blob.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download Image
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
