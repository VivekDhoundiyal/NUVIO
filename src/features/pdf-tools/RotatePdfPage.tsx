import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { RotateCw, RotateCcw, ArrowLeft, Download, RefreshCw, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PageInfo } from '../../types/document';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { StorageService } from '../../services/storage/db';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const RotatePdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setPdfBytes(uint8);
      setFileName(file.name);

      const info = await PdfEngine.getPdfInfo(uint8, file.name);
      const docProxy = await PdfEngine.loadPdfJsDoc(uint8);

      const pagesWithThumbs: PageInfo[] = [];
      const initialRotations: Record<number, number> = {};

      for (const p of info.pages) {
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 180);
        pagesWithThumbs.push({ ...p, thumbnailUrl: thumb });
        initialRotations[p.pageIndex] = 0;
      }

      setPages(pagesWithThumbs);
      setPageRotations(initialRotations);

      await StorageService.logToolUsage('rotate-pdf');
      toast.success('Document loaded', `${file.name} (${pagesWithThumbs.length} pages ready to rotate).`);
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const handleRotateAll = (delta: number) => {
    setPageRotations((prev) => {
      const next: Record<number, number> = {};
      pages.forEach((p) => {
        next[p.pageIndex] = ((prev[p.pageIndex] || 0) + delta) % 360;
      });
      return next;
    });
    toast.info('All pages rotated', `${delta > 0 ? '+' : ''}${delta}° applied across all pages.`);
  };

  const handleRotateSinglePage = (pageIndex: number, delta: number) => {
    setPageRotations((prev) => ({
      ...prev,
      [pageIndex]: ((prev[pageIndex] || 0) + delta) % 360,
    }));
  };

  const handleReset = () => {
    const reset: Record<number, number> = {};
    pages.forEach((p) => {
      reset[p.pageIndex] = 0;
    });
    setPageRotations(reset);
    toast.info('Rotations reset', 'All pages reverted to original orientation.');
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;
    setIsProcessing(true);

    try {
      const outputBytes = await PdfEngine.rotatePages(pdfBytes, pageRotations);
      const report = await ValidationEngine.validatePdf(outputBytes);

      const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-rotated.pdf';
      saveAs(blob, finalName);

      toast.success('PDF Rotated Successfully', `Saved ${finalName} (${report.score}% fidelity score).`);
    } catch (err: any) {
      toast.error('Rotation failed', err.message || 'Could not save rotated document.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Rotate PDF Online Free — Permanently Rotate PDF Pages"
        description="Rotate PDF pages online permanently. Rotate all pages or specific pages 90°, 180°, or 270°. Fast, private client-side processing with zero server uploads."
        canonicalUrl="/rotate-pdf"
        keywords={['rotate pdf', 'rotate pdf online', 'turn pdf', 'rotate pdf pages permanently', 'orient pdf']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Rotate PDF',
          url: 'https://doculoom.com/rotate-pdf',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'All',
        }}
      />

      {/* Header */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">
              <RotateCw className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Rotate PDF
            </h1>
          </div>
        </div>

        {pdfBytes && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => {
                setPdfBytes(null);
                setPages([]);
              }}
            >
              Change File
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownload}
              isLoading={isProcessing}
            >
              Save Rotated PDF
            </Button>
          </div>
        )}
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-8">
        {!pdfBytes ? (
          <div className="max-w-xl mx-auto w-full py-12 flex flex-col items-center gap-6">
            <div className="text-center flex flex-col gap-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                Rotate PDF Pages Permanently
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Rotate upside-down or sideways pages by 90°, 180°, or 270°. Processed entirely on your machine.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Rotate"
                description="Upload and rotate PDF pages instantly in browser."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Quick Batch Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCw className="w-4 h-4" />}
                  onClick={() => handleRotateAll(90)}
                >
                  Rotate All Right (+90°)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  onClick={() => handleRotateAll(-90)}
                >
                  Rotate All Left (-90°)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRotateAll(180)}
                >
                  Rotate All 180°
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-2"
                >
                  Reset Orientations
                </button>
              </div>

              <span className="text-xs font-medium text-slate-500">
                {pages.length} Pages • Click any page to rotate individually
              </span>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((p) => {
                const rotation = pageRotations[p.pageIndex] || 0;
                return (
                  <div
                    key={p.pageIndex}
                    className="group relative flex flex-col items-center p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle hover:border-brand-400 transition-all"
                  >
                    {/* Thumbnail with visual rotation transform */}
                    <div className="relative w-full h-44 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${p.pageIndex + 1}`}
                          className="max-w-full max-h-full object-contain transition-transform duration-300 shadow-2xs"
                          style={{ transform: `rotate(${rotation}deg)` }}
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-400" />
                      )}

                      {/* Hover Quick Rotate Overlay */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity backdrop-blur-2xs rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleRotateSinglePage(p.pageIndex, -90)}
                          className="p-2 rounded-full bg-white text-slate-900 shadow-md hover:scale-110 transition-transform"
                          title="Rotate 90° counter-clockwise"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateSinglePage(p.pageIndex, 90)}
                          className="p-2 rounded-full bg-white text-slate-900 shadow-md hover:scale-110 transition-transform"
                          title="Rotate 90° clockwise"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Page Label & Delta Badge */}
                    <div className="w-full flex items-center justify-between mt-2.5 px-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Page {p.pageIndex + 1}
                      </span>
                      {rotation !== 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                          +{rotation}°
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Rotate PDF"
          headline="Permanently Fix Sideways and Upside-Down PDF Pages"
          subheadline="Quickly adjust page orientation across your entire document or fine-tune individual pages with zero quality loss and complete document privacy."
          steps={[
            {
              title: 'Upload PDF Document',
              description: 'Drop your PDF into the tool. Visual thumbnails of every page will generate immediately.',
            },
            {
              title: 'Rotate Pages',
              description: 'Use the top action bar to rotate all pages at once, or click the rotation icons on individual page cards.',
            },
            {
              title: 'Save Rotated PDF',
              description: 'Click "Save Rotated PDF" to instantly download your corrected document with permanent orientation tags.',
            },
          ]}
          features={[
            {
              title: 'Permanent Orientation Fixes',
              description: 'Embeds true rotation tags into the PDF catalog so your pages stay upright across Adobe Acrobat, Chrome, and iOS.',
            },
            {
              title: 'Individual & Batch Rotation',
              description: 'Rotate all pages in one click, or rotate single scanned landscape pages without affecting portrait pages.',
            },
            {
              title: 'Lossless Vector Preservation',
              description: 'Zero re-compression of document streams. Vector paths, text fonts, and raster images remain identical.',
            },
          ]}
          faqs={[
            {
              question: 'Does rotating a PDF degrade image or text quality?',
              answer: 'No. DocuLoom modifies the internal page rotation matrix (/Rotate metadata attribute) rather than re-rendering the pages. Your text, vectors, and embedded images maintain 100% of their original quality.',
            },
            {
              question: 'Will the rotation stay permanent when sent to other users?',
              answer: 'Yes. The rotation delta is written directly into the standard PDF header structure. Any PDF reader (Adobe Acrobat, Preview, browser viewers) will display the pages in the corrected orientation permanently.',
            },
            {
              question: 'Can I rotate only specific pages in a large PDF?',
              answer: 'Yes. You can rotate individual pages by hovering over any page thumbnail and clicking the clockwise or counter-clockwise rotation arrows.',
            },
          ]}
          relatedToolIds={['organize-pdf', 'delete-pdf-pages', 'split-pdf', 'merge-pdf', 'pdf-editor']}
        />
      </main>
    </div>
  );
};
