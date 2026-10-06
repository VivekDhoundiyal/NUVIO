import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Trash2, ArrowLeft, Download, RefreshCw, FileText } from 'lucide-react';
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

export const DeletePagesPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState<string>('');
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
      for (const p of info.pages) {
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 180);
        pagesWithThumbs.push({ ...p, thumbnailUrl: thumb });
      }

      setPages(pagesWithThumbs);
      setDeletedIndices(new Set());
      setRangeInput('');

      await StorageService.logToolUsage('delete-pdf-pages');
      toast.success('Document loaded', `${file.name} (${pagesWithThumbs.length} pages ready).`);
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const togglePageDeletion = (pageIndex: number) => {
    setDeletedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        if (next.size >= pages.length - 1) {
          toast.warning('Cannot delete all pages', 'Document must keep at least 1 page.');
          return prev;
        }
        next.add(pageIndex);
      }
      return next;
    });
  };

  const handleSelectOdd = () => {
    const next = new Set<number>();
    pages.forEach((_, idx) => {
      if ((idx + 1) % 2 !== 0 && next.size < pages.length - 1) {
        next.add(idx);
      }
    });
    setDeletedIndices(next);
    toast.info('Selected odd pages', `Marked ${next.size} pages for deletion.`);
  };

  const handleSelectEven = () => {
    const next = new Set<number>();
    pages.forEach((_, idx) => {
      if ((idx + 1) % 2 === 0 && next.size < pages.length - 1) {
        next.add(idx);
      }
    });
    setDeletedIndices(next);
    toast.info('Selected even pages', `Marked ${next.size} pages for deletion.`);
  };

  const handleClear = () => {
    setDeletedIndices(new Set());
    setRangeInput('');
  };

  const handleApplyRangeInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeInput.trim()) return;

    const parts = rangeInput.split(',').map((p) => p.trim());
    const newSelected = new Set<number>();

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (!isNaN(startStr) && !isNaN(endStr)) {
          const start = Math.max(1, Math.min(startStr, endStr));
          const end = Math.min(pages.length, Math.max(startStr, endStr));
          for (let i = start; i <= end; i++) {
            newSelected.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= pages.length) {
          newSelected.add(num - 1);
        }
      }
    }

    if (newSelected.size >= pages.length) {
      toast.warning('Invalid range', 'You cannot delete all pages.');
      return;
    }

    setDeletedIndices(newSelected);
    toast.info('Range applied', `Marked ${newSelected.size} pages for deletion.`);
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;
    if (deletedIndices.size === 0) {
      toast.info('No pages deleted', 'Please click on pages to mark them for deletion.');
      return;
    }
    if (deletedIndices.size >= pages.length) {
      toast.warning('Cannot delete all pages', 'Document must keep at least 1 page.');
      return;
    }

    setIsProcessing(true);
    try {
      const remainingPages = pages.filter((p) => !deletedIndices.has(p.pageIndex));
      const pageOperations = remainingPages.map((p) => ({
        originalIndex: p.pageIndex,
        rotationDelta: 0,
      }));

      const outputBytes = await PdfEngine.reorderAndModifyPages(pdfBytes, pageOperations);
      await ValidationEngine.validatePdfOutput(outputBytes, {
        operationName: 'Delete PDF Pages',
        expectedPageCount: remainingPages.length,
      });

      const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-trimmed.pdf';
      saveAs(blob, finalName);

      toast.success('Pages Removed', `Exported ${finalName} with ${remainingPages.length} pages remaining.`);
    } catch (err: any) {
      toast.error('Deletion failed', err.message || 'Error processing document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const remainingCount = pages.length - deletedIndices.size;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Delete PDF Pages Online Free — Remove Pages from PDF"
        description="Delete unneeded pages from any PDF document for free. Select pages visually or type a range. 100% private in-browser tool with zero server uploads."
        canonicalUrl="/delete-pdf-pages"
        keywords={['delete pdf pages', 'remove pages from pdf', 'delete pages in pdf', 'delete pdf page online free', 'trim pdf']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Delete PDF Pages',
          url: 'https://doculoom.com/delete-pdf-pages',
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
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold">
              <Trash2 className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Delete PDF Pages
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
              disabled={deletedIndices.size === 0}
              isLoading={isProcessing}
            >
              Delete Pages & Download
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
                Remove Pages from PDF
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Quickly remove unwanted or blank pages. Visual click-to-delete with zero cloud uploads.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Remove Pages"
                description="Upload and visually remove PDF pages right in your browser."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectOdd}>
                  Select Odd Pages
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectEven}>
                  Select Even Pages
                </Button>
                {deletedIndices.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline ml-2"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {/* Range form */}
              <form onSubmit={handleApplyRangeInput} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1, 3, 5-7"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                />
                <Button variant="outline" size="sm" type="submit">
                  Select Range
                </Button>
              </form>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-red-600 dark:text-red-400">
                  {deletedIndices.size} marked for deletion
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {remainingCount} to keep
                </span>
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((p) => {
                const isDeleted = deletedIndices.has(p.pageIndex);
                return (
                  <div
                    key={p.pageIndex}
                    onClick={() => togglePageDeletion(p.pageIndex)}
                    className={`group relative flex flex-col items-center p-3 rounded-2xl border cursor-pointer transition-all ${
                      isDeleted
                        ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 opacity-70'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 shadow-subtle'
                    }`}
                  >
                    {/* Thumbnail Box */}
                    <div className="relative w-full h-44 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${p.pageIndex + 1}`}
                          className={`max-w-full max-h-full object-contain rounded-lg transition-transform ${
                            isDeleted ? 'filter grayscale brightness-75' : ''
                          }`}
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-400" />
                      )}

                      {/* Deletion Overlay Banner */}
                      {isDeleted && (
                        <div className="absolute inset-0 bg-red-600/30 backdrop-blur-2xs flex flex-col items-center justify-center text-white gap-1 rounded-xl">
                          <Trash2 className="w-6 h-6 text-white drop-shadow-md" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Delete
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Page Label & Action */}
                    <div className="w-full flex items-center justify-between mt-2.5 px-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Page {p.pageIndex + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={isDeleted ? 'Keep page' : 'Delete page'}
                        className={`p-1 rounded-lg transition-colors ${
                          isDeleted
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-400 hover:text-red-500'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Delete PDF Pages"
          headline="Quickly and Securely Remove Unwanted Pages from Any PDF"
          subheadline="DocuLoom provides an instant visual interface to remove blank, confidential, or duplicate pages from your PDF documents without installing software or uploading files."
          steps={[
            {
              title: 'Upload PDF Document',
              description: 'Drag and drop your PDF into the deletion workspace to generate instant page thumbnails.',
            },
            {
              title: 'Select Pages to Remove',
              description: 'Click on unwanted pages to mark them with a red trash tag, or type a custom range (e.g. 2, 4-6).',
            },
            {
              title: 'Download Clean PDF',
              description: 'Click "Delete Pages & Download" to get your trimmed, publication-ready PDF instantly.',
            },
          ]}
          features={[
            {
              title: 'Visual Click-to-Delete Interface',
              description: 'Clear visual thumbnail grid lets you inspect each page before marking it for removal.',
            },
            {
              title: 'Batch Range Syntax Support',
              description: 'Type individual numbers or ranges (e.g. 1-3, 7, 10-12) to trim large documents in seconds.',
            },
            {
              title: 'Preserves Original PDF Quality',
              description: 'Keeps all untouched pages bit-for-bit identical with full bookmarks, links, and vector clarity.',
            },
          ]}
          faqs={[
            {
              question: 'Will deleting pages change the layout or formatting of remaining pages?',
              answer: 'No. DocuLoom copies only the kept pages directly into the output document without altering any text, images, or formatting.',
            },
            {
              question: 'Are deleted pages recoverable from the exported PDF?',
              answer: 'No. The excluded pages are omitted from the new PDF document stream entirely. They do not exist anywhere inside the exported file.',
            },
            {
              question: 'Can I undo my selection before downloading?',
              answer: 'Yes. Simply click a marked page again to unmark it, or click "Clear Selection" to reset all marks.',
            },
          ]}
          relatedToolIds={['extract-pdf-pages', 'split-pdf', 'organize-pdf', 'merge-pdf', 'compress-pdf']}
        />
      </main>
    </div>
  );
};
