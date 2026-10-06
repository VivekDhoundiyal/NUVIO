import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { saveAs } from 'file-saver';
import { Pen, Download, Calendar, FileText, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PageInfo, AnnotationObject } from '../../types/document';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { AnnotationBurner } from '../../engines/annotation/annotationBurner';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { StorageService } from '../../services/storage/db';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SignatureModal } from '../pdf-editor/SignatureModal';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const SignPdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pdfJsDoc, setPdfJsDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [signatures, setSignatures] = useState<AnnotationObject[]>([]);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 140);
        pagesWithThumbs.push({ ...p, thumbnailUrl: thumb });
      }

      setPdfJsDoc(docProxy);
      setPages(pagesWithThumbs);
      setActivePageIndex(0);
      setSignatures([]);

      await StorageService.logToolUsage('sign-pdf');
      toast.success('Document loaded', `${file.name} ready for signing.`);
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  // Render active page to canvas
  React.useEffect(() => {
    if (!pdfJsDoc || pages.length === 0 || !canvasRef.current) return;
    const page = pages[activePageIndex];
    if (!page) return;

    PdfEngine.renderPageToCanvas(pdfJsDoc, activePageIndex + 1, canvasRef.current, 1.2, page.rotation || 0)
      .catch((err) => console.error('Render error:', err));
  }, [pdfJsDoc, activePageIndex, pages]);

  // Insert signature
  const handleInsertSignature = (dataUrl: string) => {
    const page = pages[activePageIndex] || pages[0];
    const newSig: AnnotationObject = {
      id: `sig-${Date.now()}`,
      type: 'signature',
      pageIndex: activePageIndex,
      x: Math.max(20, Math.round(((page?.width || 595) - 180) / 2)),
      y: Math.max(20, Math.round(((page?.height || 842) - 70) / 2)),
      width: 180,
      height: 70,
      imageDataUrl: dataUrl,
      createdAt: Date.now(),
    };
    setSignatures((prev) => [...prev, newSig]);
    toast.success('Signature placed', `Added to page ${activePageIndex + 1}.`);
  };

  // Add Date Stamp
  const handleAddDateStamp = () => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const page = pages[activePageIndex] || pages[0];
    const newDate: AnnotationObject = {
      id: `date-${Date.now()}`,
      type: 'text',
      pageIndex: activePageIndex,
      x: Math.max(20, Math.round(((page?.width || 595) - 120) / 2)),
      y: Math.max(20, Math.round(((page?.height || 842) - 30) / 2)),
      width: 120,
      height: 30,
      text: today,
      fontSize: 12,
      fontFamily: 'Helvetica, Arial, sans-serif',
      textColor: '#0f172a',
      backgroundColor: '#ffffff',
      createdAt: Date.now(),
    };
    setSignatures((prev) => [...prev, newDate]);
    toast.success('Date stamp added', `Placed date ${today} on page ${activePageIndex + 1}.`);
  };

  // Delete placed item
  const handleDeleteItem = (id: string) => {
    setSignatures((prev) => prev.filter((s) => s.id !== id));
  };

  // Export signed PDF
  const handleExportSignedPdf = async () => {
    if (!pdfBytes) return;
    setIsProcessing(true);

    try {
      const outputBytes = await AnnotationBurner.burnAllEditsAndAnnotations(pdfBytes, signatures);
      const report = await ValidationEngine.validatePdf(outputBytes);

      const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-signed.pdf';
      saveAs(blob, finalName);

      toast.success('Signed PDF Exported', `Saved ${finalName} (${report.score}% fidelity score).`);
    } catch (err: any) {
      toast.error('Export failed', err.message || 'Error signing PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const activePageSignatures = signatures.filter((s) => s.pageIndex === activePageIndex);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Sign PDF Free Online — Electronic Signature & Initials"
        description="Sign PDF documents online for free. Draw, type, or upload your electronic signature. 100% private in-browser e-signing with zero server uploads."
        canonicalUrl="/sign-pdf"
        keywords={['sign pdf', 'electronic signature', 'esign pdf', 'sign pdf online free', 'sign pdf without adobe']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Sign PDF',
          url: 'https://doculoom.com/sign-pdf',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'All',
        }}
      />

      {/* Top Banner Header */}
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
              <Pen className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Sign PDF
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
                setSignatures([]);
              }}
            >
              Change File
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportSignedPdf}
              isLoading={isProcessing}
            >
              Download Signed PDF
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
                Sign PDF Online Privately
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Create electronic signatures, add initials and sign dates. Files remain 100% on your device.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Sign"
                description="Your document is signed locally with zero cloud upload."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Sidebar Tools & Thumbnails */}
            <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shadow-subtle">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Signature Tools
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Pen className="w-4 h-4" />}
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="w-full justify-start"
                >
                  Add Signature
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Calendar className="w-4 h-4" />}
                  onClick={handleAddDateStamp}
                  className="w-full justify-start"
                >
                  Add Date Stamp
                </Button>
              </div>

              {/* Placed Items List */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Placed On Page ({activePageSignatures.length})
                  </span>
                </div>
                {activePageSignatures.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No signatures placed on this page yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activePageSignatures.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-300 capitalize truncate max-w-[140px]">
                          {item.type === 'signature' ? 'Signature' : item.text || 'Text'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Page Thumbnails */}
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
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
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

            {/* Document Preview Area */}
            <div className="flex-1 flex flex-col items-center p-6 bg-slate-100 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[600px] overflow-auto">
              <div className="relative bg-white shadow-elevated border border-slate-300 dark:border-slate-700">
                <canvas ref={canvasRef} className="block" />

                {/* Overlaid signatures on active page */}
                {activePageSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="absolute border border-brand-400 bg-brand-50/20 rounded-sm cursor-move group select-none"
                    style={{
                      left: sig.x * 1.2,
                      top: sig.y * 1.2,
                      width: sig.width * 1.2,
                      height: sig.height * 1.2,
                    }}
                  >
                    {sig.type === 'signature' && sig.imageDataUrl ? (
                      <img
                        src={sig.imageDataUrl}
                        alt="Signature"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center px-2 text-xs font-medium text-slate-900">
                        {sig.text}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(sig.id)}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Sign PDF"
          headline="Legally Binding, 100% Private Online PDF Signing"
          subheadline="DocuLoom lets you create, place, and embed electronic signatures into any PDF directly inside your browser. No server uploads, no logins, and zero fees."
          steps={[
            {
              title: 'Upload PDF Document',
              description: 'Select or drag your PDF contract, invoice, or form into the secure browser workstation.',
            },
            {
              title: 'Create Your Signature',
              description: 'Draw with a pen pad, type your name using elegant cursive fonts, or upload an image of your signature.',
            },
            {
              title: 'Place & Download Signed PDF',
              description: 'Position your signature and date on any page, then instantly export your signed document.',
            },
          ]}
          features={[
            {
              title: 'Multiple Signature Styles',
              description: 'Choose between freehand canvas drawing, cursive font rendering, or image upload for initials and signatures.',
            },
            {
              title: 'Instant Date Stamping',
              description: 'Add an automated verified local date stamp alongside your signature with one click.',
            },
            {
              title: 'Multi-Page Navigation',
              description: 'Easily navigate and place separate signatures across multi-page agreements and contracts.',
            },
          ]}
          faqs={[
            {
              question: 'Are signatures created with DocuLoom legally binding?',
              answer: 'Yes, electronic signatures created with DocuLoom comply with global electronic signature guidelines (such as the US ESIGN Act and European eIDAS regulations for simple electronic signatures) for standard business agreements, contracts, and receipts.',
            },
            {
              question: 'Are my signed documents uploaded to a cloud server?',
              answer: 'No. DocuLoom processes the PDF and burns your signature directly inside your browser using client-side JavaScript. Your confidential documents never leave your computer.',
            },
            {
              question: 'Can I add multiple signatures to different pages?',
              answer: 'Yes. You can switch between pages using the visual thumbnail selector and place signatures, initials, or date stamps on as many pages as required.',
            },
          ]}
          relatedToolIds={['pdf-editor', 'watermark-pdf', 'protect-pdf', 'merge-pdf', 'compress-pdf']}
        />
      </main>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onInsertSignature={handleInsertSignature}
      />
    </div>
  );
};
