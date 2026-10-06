import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Layers, RotateCw, ArrowLeft, ArrowRight, Trash2, Copy, ShieldCheck } from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';

interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number;
  thumbnailUrl?: string;
  aspectRatio: number;
}

export const OrganizePdfPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportedBytes, setExportedBytes] = useState<Uint8Array | null>(null);

  const handleFileSelected = async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const info = await PdfEngine.getPdfInfo(uint8, f.name);
      const docProxy = await PdfEngine.loadPdfJsDoc(uint8);

      const items: PageItem[] = [];
      for (const p of info.pages) {
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 160);
        items.push({
          id: `page-${p.pageIndex}-${Date.now()}`,
          originalIndex: p.pageIndex,
          rotation: 0,
          thumbnailUrl: thumb,
          aspectRatio: p.aspectRatio,
        });
      }

      setFile(f);
      setPdfBytes(uint8);
      setPages(items);
      await StorageService.logToolUsage('organize-pdf');
      toast.success('Document loaded', `${f.name} (${items.length} pages)`);
    } catch (e: any) {
      toast.error('Failed to parse PDF', e.message);
    }
  };

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const rotateAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
    toast.info('Rotated all pages', '+90 degrees');
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    const newPages = [...pages];
    const [moved] = newPages.splice(index, 1);
    newPages.splice(targetIdx, 0, moved);
    setPages(newPages);
  };

  const duplicatePage = (index: number) => {
    const target = pages[index];
    const newPages = [...pages];
    newPages.splice(index + 1, 0, {
      ...target,
      id: `dup-${Date.now()}`,
    });
    setPages(newPages);
    toast.success('Page duplicated', `Added copy after page ${index + 1}`);
  };

  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      toast.warning('Cannot delete only page', 'Document must have at least one page.');
      return;
    }
    setPages((prev) => prev.filter((_, i) => i !== index));
    toast.info('Page deleted', `Removed page ${index + 1}`);
  };

  const handleExport = async () => {
    if (!pdfBytes || !file || pages.length === 0) return;
    setIsProcessing(true);

    try {
      const pageOps = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotationDelta: p.rotation,
      }));

      const newPdfBytes = await PdfEngine.reorderAndModifyPages(pdfBytes, pageOps);
      setExportedBytes(newPdfBytes);

      // Automated quality validation
      const report = await ValidationEngine.validatePdfOutput(newPdfBytes, {
        expectedPageCount: pages.length,
        operationName: 'Organize PDF',
        originalPageCount: pages.length,
        originalSizeBytes: file.size,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Organized successfully', `Processed ${pages.length} pages.`);
    } catch (e: any) {
      toast.error('Reordering failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!exportedBytes || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-organized.pdf`;
    saveAs(new Blob([exportedBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Organize & Rotate PDF</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Reorder pages visually, rotate orientations, duplicate pages, or delete unneeded pages.
        </p>
      </div>

      {!file ? (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          accept=".pdf,application/pdf"
          title="Upload PDF to Organize"
          description="Drag and drop or browse from your device"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-subtle">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</h3>
                <span className="text-xs text-slate-500 font-mono">
                  {pages.length} page(s) total
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCw className="w-3.5 h-3.5" />}
                onClick={rotateAll}
              >
                Rotate All (+90°)
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isProcessing}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                onClick={handleExport}
              >
                Save & Validate
              </Button>
            </div>
          </div>

          {/* Page Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-subtle hover:border-brand-400 transition-all"
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    orig: #{p.originalIndex + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div
                  className="w-full aspect-[1/1.4] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded flex items-center justify-center overflow-hidden transition-transform"
                  style={{ transform: `rotate(${p.rotation}deg)` }}
                >
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">Page {idx + 1}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between w-full mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-0.5">
                    <IconButton
                      size="sm"
                      disabled={idx === 0}
                      aria-label="Move left"
                      onClick={() => movePage(idx, 'left')}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      disabled={idx === pages.length - 1}
                      aria-label="Move right"
                      onClick={() => movePage(idx, 'right')}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <IconButton
                      size="sm"
                      aria-label="Rotate 90 degrees"
                      onClick={() => rotatePage(idx)}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label="Duplicate page"
                      onClick={() => duplicatePage(idx)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </IconButton>
                    {pages.length > 1 && (
                      <IconButton
                        size="sm"
                        variant="danger"
                        aria-label="Delete page"
                        onClick={() => deletePage(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Organized PDF"
      />
    </div>
  );
};
