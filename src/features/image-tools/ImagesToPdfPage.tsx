import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Images, ArrowUp, ArrowDown, Trash2, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

interface ImageItem {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export const ImagesToPdfPage: React.FC = () => {
  const toast = useToast();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'AUTO'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin] = useState<number>(20);

  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    try {
      const added: ImageItem[] = [];
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
      await StorageService.logToolUsage('images-to-pdf');
      toast.success('Images added', `${files.length} image(s) queued for PDF generation`);
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

      // Automated quality validation
      const report = await ValidationEngine.validatePdfOutput(generated, {
        expectedPageCount: images.length,
        operationName: 'Images to PDF',
        originalPageCount: images.length,
        originalSizeBytes: images.reduce((acc, i) => acc + i.file.size, 0),
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('PDF generated', `Compiled ${images.length} images into document`);
    } catch (e: any) {
      toast.error('Failed to generate PDF', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!pdfBytes) return;
    const outName = 'images-collection.pdf';
    saveAs(new Blob([pdfBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Images className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Images to PDF</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Convert PNG, JPG, and WebP images into a single clean PDF with customizable page geometry.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple={true}
          title="Upload Images"
          description="Drag and drop photos or click to select multiple images"
        />

        {images.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-subtle">
            {/* Header & Page Geometry Settings */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Queued Images ({images.length})
              </span>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Page Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="A4">A4 (Standard)</option>
                    <option value="LETTER">US Letter</option>
                    <option value="AUTO">Fit Image Dimensions</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Orientation:</span>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
              {images.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold flex items-center justify-center text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded border overflow-hidden bg-slate-100 shrink-0">
                      <img src={item.dataUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.width}x{item.height}px • {(item.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <IconButton
                      size="sm"
                      disabled={idx === 0}
                      aria-label="Move image up"
                      onClick={() => moveItem(idx, 'up')}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      disabled={idx === images.length - 1}
                      aria-label="Move image down"
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

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImages([])}
                className="text-xs text-red-600 dark:text-red-400"
              >
                Clear All
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isProcessing}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleGeneratePdf}
              >
                Generate & Validate PDF
              </Button>
            </div>
          </div>
        )}
      </div>

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
