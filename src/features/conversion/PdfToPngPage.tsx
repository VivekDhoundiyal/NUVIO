import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Image as ImageIcon, Download, ShieldCheck, ArrowLeft, RefreshCw, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Progress } from '../../components/ui/Progress';
import { useToast } from '../../components/ui/useToast';
import { ImageEngine } from '../../engines/image/imageEngine';
import { StorageService } from '../../services/storage/db';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const PdfToPngPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const [dpi, setDpi] = useState<number>(150);
  const [pageSelectionMode, setPageSelectionMode] = useState<'all' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('');

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
      await StorageService.logToolUsage('pdf-to-png');
      toast.success('PDF loaded', `${f.name} ready for PNG export`);
    } catch (e: any) {
      toast.error('Failed to load PDF', e.message);
    }
  };

  const parseCustomPageIndices = (rangeStr: string): number[] | undefined => {
    if (!rangeStr.trim()) return undefined;
    const parts = rangeStr.split(',').map((p) => p.trim());
    const indices = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          for (let p = start; p <= end; p++) {
            indices.add(p - 1);
          }
        }
      } else {
        const val = parseInt(part, 10);
        if (!isNaN(val) && val > 0) {
          indices.add(val - 1);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  };

  const handleRender = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);
    setProgressPercent(5);
    setProgressStatus('Initializing client-side rendering engine...');

    try {
      const pageIndices = pageSelectionMode === 'custom' ? parseCustomPageIndices(customRange) : undefined;

      const results = await ImageEngine.renderPdfToImages(
        pdfBytes,
        {
          format: 'image/png',
          dpi,
          pageIndices,
        },
        (pct, msg) => {
          setProgressPercent(pct);
          setProgressStatus(msg);
        }
      );

      setRenderedImages(results);
      toast.success('Conversion complete', `Generated ${results.length} crisp PNG image(s)`);
    } catch (e: any) {
      toast.error('Export failed', e.message || 'An error occurred during page rendering');
    } finally {
      setIsProcessing(false);
      setProgressPercent(undefined);
      setProgressStatus('');
    }
  };

  const handleDownloadSingle = (img: { pageNumber: number; blob: Blob }) => {
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'document';
    saveAs(img.blob, `${baseName}-page-${img.pageNumber}.png`);
    toast.success('Downloaded', `Saved Page ${img.pageNumber} as PNG`);
  };

  const handleDownloadAllZip = async () => {
    if (renderedImages.length === 0) return;
    const zip = new JSZip();
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'document';

    renderedImages.forEach((img) => {
      zip.file(`${baseName}-page-${img.pageNumber}.png`, img.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${baseName}-png-pages.zip`);
    toast.success('ZIP Downloaded', `All ${renderedImages.length} PNGs archived`);
  };

  const resetAll = () => {
    setFile(null);
    setPdfBytes(null);
    setRenderedImages([]);
    setProgressPercent(undefined);
  };

  return (
    <>
      <SEOHead
        title="PDF to PNG Converter — 100% Free & Lossless | Nuvio"
        description="Convert PDF pages to lossless high-definition PNG images directly in your browser. Complete privacy with zero server uploads."
        canonicalUrl="/pdf-to-png"
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Client-Side • Local Memory Only</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mb-3 shadow-subtle">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            PDF to PNG Converter
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto mt-1.5">
            Convert PDF pages into high-resolution lossless PNG images with full transparency support and zero compression artifacts.
          </p>
        </div>

        {!file ? (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <FileDropzone
              accept=".pdf,application/pdf"
              multiple={false}
              onFilesSelected={handleFileSelected}
              title="Drop your PDF here to extract PNG images"
              description="Supports single & multi-page PDF documents. Processed 100% locally."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Controls Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Source Document</h3>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <div className="space-y-3">
                  <Select
                    label="Resolution (DPI)"
                    value={dpi.toString()}
                    onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                    options={[
                      { value: '72', label: '72 DPI (Standard Web)' },
                      { value: '150', label: '150 DPI (Balanced Crisp)' },
                      { value: '300', label: '300 DPI (High-Res Print)' },
                    ]}
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Pages to Convert
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPageSelectionMode('all')}
                        className={`py-1.5 px-3 rounded-lg border font-medium transition-colors ${
                          pageSelectionMode === 'all'
                            ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        All Pages
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageSelectionMode('custom')}
                        className={`py-1.5 px-3 rounded-lg border font-medium transition-colors ${
                          pageSelectionMode === 'custom'
                            ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>

                    {pageSelectionMode === 'custom' && (
                      <input
                        type="text"
                        placeholder="e.g. 1, 3-5, 8"
                        value={customRange}
                        onChange={(e) => setCustomRange(e.target.value)}
                        className="mt-2 w-full text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    onClick={handleRender}
                    disabled={isProcessing}
                    className="w-full justify-center bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    {isProcessing ? 'Rendering...' : 'Generate PNGs'}
                  </Button>

                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={isProcessing}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 text-center py-1"
                  >
                    Choose another file
                  </button>
                </div>
              </div>

              {renderedImages.length > 0 && (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold mb-2">
                    <Check className="w-4 h-4" />
                    <span>{renderedImages.length} Image(s) Rendered</span>
                  </div>
                  <Button
                    onClick={handleDownloadAllZip}
                    variant="primary"
                    className="w-full justify-center text-xs py-2 gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download All as ZIP
                  </Button>
                </div>
              )}
            </div>

            {/* Right Gallery / Processing View */}
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[380px] flex flex-col">
                {isProcessing && (
                  <div className="my-auto py-12 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                    <RefreshCw className="w-8 h-8 text-brand-600 dark:text-brand-400 animate-spin mb-4" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      Rendering Lossless PNGs
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{progressStatus}</p>
                    <Progress value={progressPercent} className="w-full" />
                  </div>
                )}

                {!isProcessing && renderedImages.length === 0 && (
                  <div className="my-auto py-12 flex flex-col items-center justify-center text-center text-slate-400">
                    <ImageIcon className="w-12 h-12 stroke-[1.2] mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Configure your settings and click &quot;Generate PNGs&quot;
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Each page will be rendered with true pixel crispness and transparent background fidelity.
                    </p>
                  </div>
                )}

                {!isProcessing && renderedImages.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Generated Previews ({renderedImages.length})
                      </span>
                      <span className="text-xs text-slate-500">Click any image to download</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {renderedImages.map((img) => (
                        <div
                          key={img.pageNumber}
                          className="group relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col hover:border-brand-500 transition-all shadow-xs"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-checkerboard flex items-center justify-center">
                            <img
                              src={img.dataUrl}
                              alt={`Page ${img.pageNumber}`}
                              className="max-h-full max-w-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleDownloadSingle(img)}
                                className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold shadow hover:bg-slate-100 flex items-center gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Save PNG
                              </button>
                            </div>
                          </div>
                          <div className="px-3 py-2 text-xs flex items-center justify-between bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Page {img.pageNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {(img.blob.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ToolSEOContent
          toolName="PDF to PNG Converter"
          headline="Fast, Local, and Lossless PDF to PNG Conversion"
          subheadline="Render high-fidelity PNG images from PDF pages right inside your browser"
          steps={[
            {
              title: 'Upload Your PDF',
              description: 'Select your PDF document or drag and drop it into the conversion zone.',
            },
            {
              title: 'Select Resolution & Range',
              description: 'Choose your desired DPI (72, 150, 300) and convert all pages or a custom page range.',
            },
            {
              title: 'Download Crisp PNGs',
              description: 'Download individual lossless PNG images or package all pages into a single ZIP file.',
            },
          ]}
          features={[
            {
              title: 'Lossless Transparency',
              description: 'Extract graphics and pages with sharp edges and transparent layers where supported.',
            },
            {
              title: '300 DPI High-Res Output',
              description: 'Choose up to 300 DPI for crystal clear print-quality raster images.',
            },
            {
              title: '100% Client-Side Privacy',
              description: 'Your files are never transmitted to any external server. Processing happens in local browser memory.',
            },
          ]}
          faqs={[
            {
              question: 'Why convert PDF to PNG instead of JPG?',
              answer: 'PNG uses lossless compression, meaning no artifacts or blurring around text and sharp line art, making it ideal for diagrams, screenshots, and logos.',
            },
            {
              question: 'Are there limits on how many pages I can convert?',
              answer: 'No artificial limits! You can convert entire documents or select specific page ranges like 1, 3-5.',
            },
            {
              question: 'Does Nuvio store my converted images?',
              answer: 'Never. All rendering occurs locally on your machine via WebAssembly and Canvas APIs. No data ever leaves your computer.',
            },
          ]}
          relatedToolIds={['pdf-to-jpg', 'png-to-pdf', 'pdf-editor', 'compress-pdf']}
        />
      </div>
    </>
  );
};
