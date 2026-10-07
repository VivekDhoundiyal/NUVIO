import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { saveAs } from 'file-saver';
import { ShieldAlert, ArrowLeft, Download, RefreshCw, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PageInfo } from '../../types/document';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { PdfRedactionEngine, type RedactionArea } from '../../engines/pdf/pdfRedactionEngine';
import { StorageService } from '../../services/storage/db';
import { FileSessionStore } from '../../services/storage/fileSessionStore';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const RedactPdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pdfJsDoc, setPdfJsDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [redactions, setRedactions] = useState<RedactionArea[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
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
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 140);
        pagesWithThumbs.push({ ...p, thumbnailUrl: thumb });
      }

      setPdfJsDoc(docProxy);
      setPages(pagesWithThumbs);
      setActivePageIndex(0);
      setRedactions([]);

      await StorageService.logToolUsage('redact-pdf');
      toast.success('Document loaded', 'Draw black boxes over confidential text to redact.');
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  }, [toast]);

  const hasLoadedSessionRef = useRef(false);

  // Auto-load active file from session
  useEffect(() => {
    if (hasLoadedSessionRef.current) return;
    const active = FileSessionStore.getActiveFile();
    if (active) {
      hasLoadedSessionRef.current = true;
      setTimeout(() => {
        handleFileSelected([active.file]);
      }, 0);
    }
  }, [handleFileSelected]);

  // Render active page to canvas
  useEffect(() => {
    if (!pdfJsDoc || pages.length === 0 || !canvasRef.current) return;
    const page = pages[activePageIndex];
    if (!page) return;

    PdfEngine.renderPageToCanvas(pdfJsDoc, activePageIndex + 1, canvasRef.current, 1.2, page.rotation || 0)
      .catch((err) => console.error('Render error:', err));
  }, [pdfJsDoc, activePageIndex, pages]);

  // Mouse handlers for drawing redaction boxes
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, (e.clientX - rect.left) / 1.2);
    const y = Math.max(0, (e.clientY - rect.top) / 1.2);

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPoint || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.max(0, (e.clientX - rect.left) / 1.2);
    const curY = Math.max(0, (e.clientY - rect.top) / 1.2);

    const x = Math.min(startPoint.x, curX);
    const y = Math.min(startPoint.y, curY);
    const width = Math.abs(curX - startPoint.x);
    const height = Math.abs(curY - startPoint.y);

    setCurrentBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.width > 10 && currentBox.height > 6) {
      const newArea: RedactionArea = {
        id: `redact-${Date.now()}`,
        pageIndex: activePageIndex,
        x: Math.round(currentBox.x),
        y: Math.round(currentBox.y),
        width: Math.round(currentBox.width),
        height: Math.round(currentBox.height),
      };
      setRedactions((prev) => [...prev, newArea]);
      toast.info('Redaction area marked', `Added ${newArea.width}×${newArea.height}pt blackout box.`);
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);
  };

  const handleRemoveRedaction = (id: string) => {
    setRedactions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApplyRedactions = async () => {
    if (!pdfBytes || redactions.length === 0) {
      toast.warning('No redactions selected', 'Draw at least one black box over confidential info.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await PdfRedactionEngine.applyPermanentRedactions(pdfBytes, redactions);

      const blob = new Blob([result.pdfBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-redacted.pdf';
      saveAs(blob, finalName);

      toast.success(
        'Redaction Complete & Permanent',
        `Sanitized ${result.sanitizedTextItemCount} text items across ${result.redactedAreaCount} areas.`
      );
    } catch (err: any) {
      toast.error('Redaction failed', err.message || 'Error executing redactions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const activePageRedactions = redactions.filter((r) => r.pageIndex === activePageIndex);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Redact PDF Online Free — Permanently Black Out Confidential Info"
        description="Permanently black out and redact private text, numbers, and SSNs from PDF files. Irreversible client-side redaction with zero server uploads."
        canonicalUrl="/redact-pdf"
        keywords={['redact pdf', 'black out pdf', 'permanently redact pdf', 'remove sensitive info from pdf', 'redact pdf online free']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Redact PDF',
          url: 'https://doculoom.com/redact-pdf',
          applicationCategory: 'SecurityApplication',
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
            <div className="w-7 h-7 rounded-lg bg-slate-950 text-white flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4 text-red-500" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Redact PDF
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
                setRedactions([]);
                FileSessionStore.clear();
              }}
            >
              Change File
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleApplyRedactions}
              disabled={redactions.length === 0}
              isLoading={isProcessing}
            >
              Apply Redaction & Download
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
                Permanently Black Out Private Data
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Irreversibly sanitize sensitive financial, medical, and personal identifiers. Processed 100% locally.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Redact"
                description="Upload PDF and drag to black out text permanently."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sidebar Controls */}
            <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shadow-subtle">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Irreversible Security</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Click and drag your mouse across any sensitive text to draw a blackout box. When applied, underlying text is permanently purged.
                </p>
              </div>

              {/* Pending Redactions List */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Redactions ({redactions.length})
                  </span>
                  {redactions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRedactions([])}
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {redactions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No redaction boxes drawn yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {redactions.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          P.{r.pageIndex + 1} ({r.width}×{r.height}pt)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRedaction(r.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="Remove redaction box"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Page Selector Thumbnails */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2 shadow-subtle max-h-80 overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Page ({pages.length})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {pages.map((p) => (
                    <button
                      key={p.pageIndex}
                      type="button"
                      onClick={() => setActivePageIndex(p.pageIndex)}
                      className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                        activePageIndex === p.pageIndex
                          ? 'border-red-500 bg-red-50/40 dark:bg-red-950/40 ring-2 ring-red-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {p.thumbnailUrl ? (
                        <img
                          src={p.thumbnailUrl}
                          alt={`Page ${p.pageIndex + 1}`}
                          className="w-full h-24 object-contain rounded-lg bg-white shadow-2xs"
                        />
                      ) : (
                        <div className="w-full h-24 bg-slate-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-1">
                        Page {p.pageIndex + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Document Interactive Redaction Canvas */}
            <div className="flex-1 flex flex-col items-center p-6 bg-slate-100 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[600px] overflow-auto select-none">
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="relative bg-white shadow-elevated border border-slate-300 dark:border-slate-700 cursor-crosshair"
              >
                <canvas ref={canvasRef} className="block pointer-events-none" />

                {/* Drawn Redaction Boxes on active page */}
                {activePageRedactions.map((box) => (
                  <div
                    key={box.id}
                    className="absolute bg-black rounded-xs flex items-center justify-center group"
                    style={{
                      left: box.x * 1.2,
                      top: box.y * 1.2,
                      width: box.width * 1.2,
                      height: box.height * 1.2,
                    }}
                  >
                    <span className="text-[10px] text-white/50 uppercase tracking-widest font-mono pointer-events-none">
                      REDACTED
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRedaction(box.id);
                      }}
                      className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Currently Drawing Box Preview */}
                {isDrawing && currentBox && (
                  <div
                    className="absolute bg-black/80 border-2 border-red-500 rounded-xs pointer-events-none"
                    style={{
                      left: currentBox.x * 1.2,
                      top: currentBox.y * 1.2,
                      width: currentBox.width * 1.2,
                      height: currentBox.height * 1.2,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Redact PDF"
          headline="Permanently Redact and Black Out Sensitive PDF Content"
          subheadline="DocuLoom does not merely cover text with a visual shape. It scrubs the underlying content streams so confidential information cannot be copied, selected, or recovered."
          steps={[
            {
              title: 'Upload Document',
              description: 'Select your PDF. It is rendered directly into your browser canvas without network transmission.',
            },
            {
              title: 'Drag Over Confidential Content',
              description: 'Click and drag to mark names, bank accounts, SSNs, and addresses with solid black redaction blocks.',
            },
            {
              title: 'Apply & Download Redacted PDF',
              description: 'Click "Apply Redaction & Download" to burn permanent opaque masks and purge underlying text permanently.',
            },
          ]}
          features={[
            {
              title: 'True Text Purging',
              description: 'Underlying text characters are filtered out so that copying, selecting, or searching the text returns 0 results.',
            },
            {
              title: 'Opaque Vector Masks',
              description: 'Employs true black RGB vector rectangles that permanently cover all underlying visual layers.',
            },
            {
              title: 'Audit Verification',
              description: 'Provides exact counts of redacted bounding boxes and purged text elements upon export.',
            },
          ]}
          faqs={[
            {
              question: 'Can someone copy the text underneath the black boxes in DocuLoom?',
              answer: 'No. Unlike basic PDF viewers that just place a floating black annotation, DocuLoom scrubs the content streams to ensure the underlying text characters are permanently removed.',
            },
            {
              question: 'Is redaction reversible once downloaded?',
              answer: 'No. Redaction is mathematically permanent and irreversible. We recommend keeping a private backup of your original unredacted file.',
            },
            {
              question: 'Can I redact images and logos as well as text?',
              answer: 'Yes. You can draw redaction boxes over graphics, signatures, photographs, and barcodes.',
            },
          ]}
          relatedToolIds={['protect-pdf', 'sign-pdf', 'pdf-editor', 'compress-pdf', 'merge-pdf']}
        />
      </main>
    </div>
  );
};
