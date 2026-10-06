import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { CheckSquare, ArrowLeft, Download, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
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

export const ExtractPagesPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState<string>('');
  const [extractMode, setExtractMode] = useState<'single' | 'zip'>('single');
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
      setSelectedIndices(new Set([0])); // Default select first page
      setRangeInput('1');

      await StorageService.logToolUsage('extract-pdf-pages');
      toast.success('Document loaded', `${file.name} ready for extraction.`);
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const togglePageSelection = (pageIndex: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIndices(new Set(pages.map((p) => p.pageIndex)));
  };

  const handleSelectNone = () => {
    setSelectedIndices(new Set());
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

    setSelectedIndices(newSelected);
    toast.info('Range applied', `Selected ${newSelected.size} pages.`);
  };

  const handleDownload = async () => {
    if (!pdfBytes) return;
    if (selectedIndices.size === 0) {
      toast.warning('No pages selected', 'Please select at least 1 page to extract.');
      return;
    }

    setIsProcessing(true);
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);

    try {
      if (extractMode === 'single') {
        const outputBytes = await PdfEngine.extractPages(pdfBytes, sortedIndices);
        await ValidationEngine.validatePdfOutput(outputBytes, {
          operationName: 'Extract PDF Pages',
          expectedPageCount: sortedIndices.length,
        });

        const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
        const finalName = fileName.replace(/\.pdf$/i, '') + '-extracted.pdf';
        saveAs(blob, finalName);
        toast.success('Pages Extracted', `Saved ${finalName} with ${sortedIndices.length} pages.`);
      } else {
        // Zip mode
        const zip = new JSZip();
        const baseName = fileName.replace(/\.pdf$/i, '');

        for (const idx of sortedIndices) {
          const singlePageBytes = await PdfEngine.extractPages(pdfBytes, [idx]);
          zip.file(`${baseName}-page-${idx + 1}.pdf`, singlePageBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${baseName}-extracted-pages.zip`);
        toast.success('ZIP Downloaded', `Extracted ${sortedIndices.length} separate PDF pages into ZIP archive.`);
      }
    } catch (err: any) {
      toast.error('Extraction failed', err.message || 'Error extracting pages.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Extract PDF Pages Online Free — Separate Pages from PDF"
        description="Extract specific pages or page ranges from any PDF document. Download as a single combined PDF or separate individual files in a ZIP archive. Fast and private."
        canonicalUrl="/extract-pdf-pages"
        keywords={['extract pdf pages', 'separate pdf pages', 'extract pages from pdf', 'save specific pdf pages', 'extract pdf online free']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Extract PDF Pages',
          url: 'https://doculoom.com/extract-pdf-pages',
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
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Extract PDF Pages
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
              disabled={selectedIndices.size === 0}
              isLoading={isProcessing}
            >
              Extract & Download ({selectedIndices.size})
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
                Extract Specific Pages from PDF
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Select and save only the pages you need. Download as one unified PDF or a ZIP of individual pages.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Extract Pages"
                description="Extract pages privately with 100% vector fidelity."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectNone}>
                  Clear Selection
                </Button>

                {/* Extract Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs ml-2">
                  <button
                    type="button"
                    onClick={() => setExtractMode('single')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      extractMode === 'single'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Merge into 1 PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtractMode('zip')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      extractMode === 'zip'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Separate Pages (ZIP)
                  </button>
                </div>
              </div>

              {/* Range form */}
              <form onSubmit={handleApplyRangeInput} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1-3, 5, 8"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                />
                <Button variant="outline" size="sm" type="submit">
                  Apply Range
                </Button>
              </form>

              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {selectedIndices.size} of {pages.length} pages selected
              </span>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {pages.map((p) => {
                const isSelected = selectedIndices.has(p.pageIndex);
                return (
                  <div
                    key={p.pageIndex}
                    onClick={() => togglePageSelection(p.pageIndex)}
                    className={`group relative flex flex-col items-center p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 opacity-70'
                    }`}
                  >
                    {/* Thumbnail Box */}
                    <div className="relative w-full h-44 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${p.pageIndex + 1}`}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xs"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-400" />
                      )}

                      {/* Checkmark Icon Top-Right */}
                      <div className="absolute top-2 right-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600" />
                        )}
                      </div>
                    </div>

                    {/* Page Label */}
                    <div className="w-full flex items-center justify-between mt-2.5 px-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Page {p.pageIndex + 1}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                          Selected
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
          toolName="Extract PDF Pages"
          headline="Pull Key Pages from Multi-Page PDFs Instantly"
          subheadline="DocuLoom lets you pick out specific pages or page intervals and download them as a brand-new PDF or separate files in a ZIP archive with complete privacy."
          steps={[
            {
              title: 'Upload PDF',
              description: 'Drop your multi-page document into the extractor to view all pages in a visual grid.',
            },
            {
              title: 'Choose Pages to Extract',
              description: 'Click on individual pages or enter a page range (e.g. 1-3, 7). Choose single PDF or separate ZIP files.',
            },
            {
              title: 'Download Extracted Document',
              description: 'Click "Extract & Download" to immediately download your chosen pages.',
            },
          ]}
          features={[
            {
              title: 'Flexible Output Options',
              description: 'Download the selected pages merged into a single clean PDF or unpack them as separate single-page PDFs in a ZIP archive.',
            },
            {
              title: 'Zero Recompression or Quality Loss',
              description: 'Extracted pages carry their exact original vector paths, TrueType fonts, high-res images, and hyperlinked annotations.',
            },
            {
              title: 'Batch Range Expression Parser',
              description: 'Easily select large ranges like "5-20, 25, 30-35" in a single keystroke.',
            },
          ]}
          faqs={[
            {
              question: 'Does extracting pages modify my original PDF file?',
              answer: 'No. Your original file remains untouched on your computer. DocuLoom creates a new PDF containing only the pages you selected.',
            },
            {
              question: 'Can I extract pages from password-protected PDFs?',
              answer: 'Yes. If your PDF is password-protected, simply unlock it first using our Unlock PDF tool, then extract the pages.',
            },
            {
              question: 'Is there any limit on how many pages I can extract?',
              answer: 'No. Because all processing happens client-side directly on your device, you can extract as many pages as your browser memory permits without file size limits.',
            },
          ]}
          relatedToolIds={['split-pdf', 'delete-pdf-pages', 'merge-pdf', 'organize-pdf', 'compress-pdf']}
        />
      </main>
    </div>
  );
};
