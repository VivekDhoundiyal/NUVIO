import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Images, ArrowUp, ArrowDown, Trash2, ShieldCheck, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
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

interface JpgItem {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export const JpgToPdfPage: React.FC = () => {
  const toast = useToast();
  const [images, setImages] = useState<JpgItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'AUTO'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState<number>(20);

  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    try {
      const added: JpgItem[] = [];
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
      await StorageService.logToolUsage('jpg-to-pdf');
      toast.success('Images added', `${files.length} JPG image(s) queued for PDF generation`);
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
        operationName: 'JPG to PDF',
        originalPageCount: images.length,
        originalSizeBytes: images.reduce((acc, i) => acc + i.file.size, 0),
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('PDF generated', `Compiled ${images.length} JPG photos into PDF`);
    } catch (e: any) {
      toast.error('Failed to generate PDF', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytes) return;
    const outName = 'converted-images.pdf';
    saveAs(new Blob([pdfBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <SEOHead
        title="JPG to PDF Converter - Merge JPGs to PDF Online Free | DocuLoom"
        description="Convert and combine JPG photos into a single professional PDF document. Reorder pages, adjust margins and page orientation with 100% private client-side processing."
        canonicalUrl="https://doculoom.com/jpg-to-pdf"
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom JPG to PDF Converter',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires modern web browser with HTML5 Canvas.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: [
            'Batch JPG image merging to PDF',
            'Visual page reordering and drag arrangement',
            'Custom page formats (A4, US Letter, Auto Fit)',
            'Zero server upload - 100% private in-browser compilation',
          ],
        }}
      />

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Images className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">JPG to PDF</span>
            </div>
          </div>

          {images.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImages([])}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Clear All
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full flex flex-col gap-8">
        {images.length === 0 ? (
          <div className="flex flex-col gap-6 py-6">
            <div className="text-center max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
                <Sparkles className="w-3 h-3" />
                Combine Unlimited JPG Images to PDF
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-100">
                Convert JPG Images to PDF
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Easily merge, reorder, and convert JPG, JPEG, and PNG images into a clean, unified PDF. 
                All conversions run locally on your device for absolute privacy.
              </p>
            </div>

            <div className="max-w-2xl mx-auto w-full">
              <FileDropzone
                onFilesSelected={handleFilesSelected}
                accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple={true}
                title="Select or Drop JPG Images"
                description="Upload multiple images at once to merge them into a single PDF"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {/* Header & Settings */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">
                  Queued JPG Images ({images.length})
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {(images.reduce((acc, i) => acc + i.file.size, 0) / (1024 * 1024)).toFixed(2)} MB total
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Page Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="A4">A4 Standard</option>
                    <option value="LETTER">US Letter</option>
                    <option value="AUTO">Fit Original Image</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Orientation:</span>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Margin:</span>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value={0}>No Margin (Edge-to-Edge)</option>
                    <option value={15}>Compact Margin</option>
                    <option value={30}>Standard Margin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List of Images */}
            <div className="divide-y divide-slate-800/80 max-h-[460px] overflow-y-auto pr-1">
              {images.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-[11px] font-mono font-bold flex items-center justify-center text-slate-400 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded border border-slate-700 overflow-hidden bg-slate-900 shrink-0">
                      <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.width} × {item.height} px • {(item.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      size="sm"
                      disabled={idx === 0}
                      aria-label="Move up"
                      onClick={() => moveItem(idx, 'up')}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      disabled={idx === images.length - 1}
                      aria-label="Move down"
                      onClick={() => moveItem(idx, 'down')}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="danger"
                      aria-label="Remove image"
                      onClick={() => removeImage(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
                  input.onchange = (e: any) => {
                    if (e.target.files) handleFilesSelected(Array.from(e.target.files));
                  };
                  input.click();
                }}
              >
                + Add More Images
              </Button>

              <Button
                variant="primary"
                size="md"
                isLoading={isProcessing}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleGeneratePdf}
              >
                Generate & Download PDF
              </Button>
            </div>
          </div>
        )}

        <ToolSEOContent
          toolName="JPG to PDF Converter"
          headline="Convert & Merge JPG Images to PDF Online Free"
          subheadline="Combine multiple JPG, JPEG, and PNG images into a clean PDF document with 100% private in-browser processing."
          steps={[
            {
              title: 'Upload JPG Photos',
              description: 'Select or drag multiple JPG, JPEG, or PNG images into the converter workstation.',
            },
            {
              title: 'Reorder & Configure',
              description: 'Sort your images in any custom order, and choose your preferred page geometry, orientation, and margin.',
            },
            {
              title: 'Download Unified PDF',
              description: 'Click Generate to compile all your images into a single, high-fidelity PDF file.',
            },
          ]}
          features={[
            {
              title: 'Fast Visual Sorting',
              description: 'Easily rearrange your images in exact sequence using intuitive order controls before compiling.',
            },
            {
              title: 'Zero Server Latency',
              description: 'All image compression and PDF vector generation execute locally on your device with zero cloud delays.',
            },
            {
              title: 'Lossless Visual Precision',
              description: 'Images are embedded with optimal dimensions to maintain visual clarity while keeping file sizes lightweight.',
            },
          ]}
          faqs={[
            {
              question: 'How many JPG images can I combine into one PDF?',
              answer: 'You can combine as many JPG images as your device memory allows—typically dozens or hundreds of photos in a single run with DocuLoom’s optimized streaming pipeline.',
            },
            {
              question: 'Are my private photos uploaded to a third-party server?',
              answer: 'Never. DocuLoom compiles your PDF completely inside your web browser. Your private pictures remain entirely on your computer or phone.',
            },
            {
              question: 'Can I combine both JPG and PNG images together?',
              answer: 'Yes! The converter accepts JPG, JPEG, PNG, and WebP files interchangeably and embeds them seamlessly into your unified PDF.',
            },
          ]}
          relatedToolIds={['pdf-to-jpg', 'images-to-pdf', 'merge-pdf', 'compress-pdf', 'pdf-editor']}
        />
      </main>

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
