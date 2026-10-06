import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Images, ArrowUp, ArrowDown, Trash2, ShieldCheck, ArrowLeft, Download, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

interface PngItem {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export const PngToPdfPage: React.FC = () => {
  const toast = useToast();
  const [images, setImages] = useState<PngItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'AUTO'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState<number>(20);

  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    try {
      const added: PngItem[] = [];
      for (const file of files) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = dataUrl;
        });

        added.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          dataUrl,
          width: img.width,
          height: img.height,
        });
      }

      setImages((prev) => [...prev, ...added]);
      await StorageService.logToolUsage('png-to-pdf');
      toast.success('Images added', `${files.length} PNG image(s) queued for PDF compilation`);
    } catch (e: any) {
      toast.error('Failed to load images', e.message);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const newImgs = [...images];
    const [moved] = newImgs.splice(index, 1);
    newImgs.splice(targetIdx, 0, moved);
    setImages(newImgs);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    try {
      const generated = await PdfEngine.imagesToPdf(images, {
        pageSize,
        orientation,
        margin,
      });

      setPdfBytes(generated);

      const report = await ValidationEngine.validatePdfOutput(generated, {
        expectedPageCount: images.length,
        operationName: 'PNG to PDF',
        originalPageCount: images.length,
      });
      setValidationReport(report);

      toast.success('PDF compiled successfully', `Created ${images.length} page PDF document`);
    } catch (e: any) {
      toast.error('Generation failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytes) return;
    const safeBuffer = new Uint8Array(pdfBytes.slice(0));
    const blob = new Blob([safeBuffer], { type: 'application/pdf' });
    const name = images.length === 1 ? images[0].file.name.replace(/\.[^/.]+$/, '') : 'compiled-images';
    saveAs(blob, `${name}.pdf`);
    toast.success('Download initiated', 'Your PDF was saved locally');
  };

  const resetAll = () => {
    setImages([]);
    setPdfBytes(null);
    setValidationReport(undefined);
  };

  return (
    <>
      <SEOHead
        title="PNG to PDF Converter — Free & Instant Batch Image Merge | Nuvio"
        description="Convert multiple PNG images to a single clean PDF document entirely in your browser with zero server uploads."
        canonicalUrl="/png-to-pdf"
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
            <Images className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            PNG to PDF Converter
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto mt-1.5">
            Convert individual or multiple PNG images into a clean, unified, printable PDF. Reorder pages and customize paper layout instantly.
          </p>
        </div>

        {images.length === 0 ? (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <FileDropzone
              accept=".png,image/png"
              multiple={true}
              onFilesSelected={handleFilesSelected}
              title="Drop your PNG images here"
              description="Select one or multiple PNG images. Reorder and export to PDF."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Options Column */}
            <div className="md:col-span-1 space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Images Queue ({images.length})
                  </h3>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                  >
                    Clear all
                  </button>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Page Size
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      {(['A4', 'LETTER', 'AUTO'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setPageSize(size)}
                          className={`py-1.5 rounded-lg border font-medium text-center transition-colors ${
                            pageSize === size
                              ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Orientation
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(['portrait', 'landscape'] as const).map((ori) => (
                        <button
                          key={ori}
                          type="button"
                          onClick={() => setOrientation(ori)}
                          className={`py-1.5 rounded-lg border capitalize font-medium text-center transition-colors ${
                            orientation === ori
                              ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {ori}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Page Margin: {margin}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={margin}
                      onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                      className="w-full accent-brand-600"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleGeneratePdf}
                    disabled={isProcessing}
                    className="w-full justify-center bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    {isProcessing ? 'Compiling PDF...' : 'Convert to PDF'}
                  </Button>
                </div>
              </div>

              {pdfBytes && (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PDF Ready ({(pdfBytes.length / 1024).toFixed(0)} KB)</span>
                  </div>

                  <Button
                    onClick={handleDownload}
                    variant="primary"
                    className="w-full justify-center text-xs py-2 gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </Button>

                  {validationReport && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="w-full text-center text-xs text-brand-600 hover:underline pt-1"
                    >
                      View Quality Audit ({validationReport.score}/100)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right Images Ordering Column */}
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Page Order ({images.length} pages)
                  </span>
                  <label className="cursor-pointer text-xs font-semibold text-brand-600 hover:underline">
                    + Add More Images
                    <input
                      type="file"
                      accept=".png"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
                    />
                  </label>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl"
                    >
                      <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                      <img
                        src={img.dataUrl}
                        alt={img.file.name}
                        className="w-12 h-12 object-contain bg-checkerboard rounded border border-slate-200 dark:border-slate-700"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {img.file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {img.width} × {img.height}px • {(img.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <IconButton
                          aria-label="Move up"
                          onClick={() => moveItem(idx, 'up')}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          aria-label="Move down"
                          onClick={() => moveItem(idx, 'down')}
                          disabled={idx === images.length - 1}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          aria-label="Remove image"
                          onClick={() => removeImage(img.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <ToolSEOContent
          toolName="PNG to PDF Converter"
          headline="Convert PNG Images to Professional PDF Documents"
          subheadline="Combine PNGs into unified, printable PDF documents on your own device"
          steps={[
            {
              title: 'Upload PNG Files',
              description: 'Select or drag multiple PNG images into the compiler list.',
            },
            {
              title: 'Arrange & Configure',
              description: 'Reorder pages, set orientation, choose paper size (A4, Letter), and adjust margins.',
            },
            {
              title: 'Export Merged PDF',
              description: 'Compile the document in seconds and download directly to your computer.',
            },
          ]}
          features={[
            {
              title: 'Multi-Image Batch Merge',
              description: 'Upload multiple PNG files at once and arrange them into the exact page sequence you want.',
            },
            {
              title: 'Standard Paper Sizes',
              description: 'Choose between ISO A4, US Letter, or auto-fit paper dimensions to match your printer.',
            },
            {
              title: 'Guaranteed On-Device Privacy',
              description: 'Your photos and documents never touch a third-party server. Everything executes locally in your browser memory.',
            },
          ]}
          faqs={[
            {
              question: 'Will my PNG images lose resolution or quality?',
              answer: 'No. Nuvio embeds PNG image bytes directly into the PDF container without recompressing or downscaling them.',
            },
            {
              question: 'Can I reorder the images before generating the PDF?',
              answer: 'Yes! You can reorder images using the arrow buttons or add additional PNGs at any time.',
            },
            {
              question: 'Is there a limit on how many PNG files I can merge?',
              answer: 'No hard limit. Since processing runs in your browser, you can merge dozens of images effortlessly.',
            },
          ]}
          relatedToolIds={['pdf-to-png', 'jpg-to-pdf', 'merge-pdf', 'pdf-editor']}
        />
      </div>

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
      />
    </>
  );
};
