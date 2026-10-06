import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Image as ImageIcon, Download, ShieldCheck, ArrowLeft, RefreshCw, Check, Sparkles } from 'lucide-react';
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

export const PdfToJpgPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  const [dpi, setDpi] = useState<number>(150);
  const [quality, setQuality] = useState<number>(0.9);
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
      await StorageService.logToolUsage('pdf-to-jpg');
      toast.success('PDF loaded', `${f.name} ready for JPG export`);
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
          format: 'image/jpeg',
          dpi,
          quality,
          pageIndices,
        },
        (pct, msg) => {
          setProgressPercent(pct);
          setProgressStatus(msg);
        }
      );

      setRenderedImages(results);
      toast.success('Conversion complete', `Generated ${results.length} high-resolution JPG image(s)`);
    } catch (e: any) {
      toast.error('Conversion failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = (index: number) => {
    const img = renderedImages[index];
    if (!img || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-page-${img.pageNumber}.jpg`;
    saveAs(img.blob, outName);
    toast.success('Downloaded JPG', outName);
  };

  const handleDownloadAllZip = async () => {
    if (renderedImages.length === 0 || !file) return;
    const zip = new JSZip();
    const base = file.name.replace(/\.pdf$/i, '');

    renderedImages.forEach((img) => {
      zip.file(`${base}-page-${img.pageNumber}.jpg`, img.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `${base}-jpg-images.zip`;
    saveAs(zipBlob, zipName);
    toast.success('Downloaded ZIP archive', zipName);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <SEOHead
        title="PDF to JPG Converter - Free & High Resolution | DocuLoom"
        description="Convert PDF pages to high-quality JPG images directly in your browser. 100% private client-side processing, selectable DPI, custom quality and instant ZIP archive download."
        canonicalUrl="https://doculoom.com/pdf-to-jpg"
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom PDF to JPG Converter',
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript and HTML5 Canvas support.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          featureList: [
            'Client-side PDF to JPG extraction',
            'Selectable 72, 150, or 300 DPI resolutions',
            'Tunable JPEG compression quality',
            'Individual JPG or bulk ZIP download',
            'Zero server uploads - 100% private',
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
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">PDF to JPG</span>
            </div>
          </div>

          {file && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setPdfBytes(null);
                setRenderedImages([]);
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Choose New File
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full flex flex-col gap-8">
        {!file ? (
          <div className="flex flex-col gap-6 py-6">
            <div className="text-center max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-3">
                <Sparkles className="w-3 h-3" />
                Ultra-Fast Client-Side Image Extraction
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-100">
                Convert PDF to JPG Images
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Extract high-definition JPG pictures from any PDF document in seconds. 
                Everything happens securely on your device—your confidential files are never uploaded to any server.
              </p>
            </div>

            <div className="max-w-2xl mx-auto w-full">
              <FileDropzone
                onFilesSelected={handleFileSelected}
                accept=".pdf,application/pdf"
                title="Select or Drop PDF File"
                description="Supports any PDF document up to 100 MB"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">{file.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB • PDF Document
                </p>
              </div>
            </div>

            {/* Conversion Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Resolution Quality"
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
                options={[
                  { label: 'Web Standard (72 DPI)', value: 72 },
                  { label: 'Medium / Print (150 DPI - Recommended)', value: 150 },
                  { label: 'Ultra HD (300 DPI - Crisp)', value: 300 },
                ]}
              />

              <Select
                label="JPG Compression Quality"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                options={[
                  { label: 'High Quality (90% - Recommended)', value: 0.9 },
                  { label: 'Maximum Quality (98%)', value: 0.98 },
                  { label: 'Balanced File Size (80%)', value: 0.8 },
                  { label: 'Compact Size (65%)', value: 0.65 },
                ]}
              />

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Page Selection
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSelectionMode}
                    onChange={(e) => setPageSelectionMode(e.target.value as any)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="all">All Pages</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              </div>
            </div>

            {pageSelectionMode === 'custom' && (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Custom Page Range
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1, 3, 5-8"
                  value={customRange}
                  onChange={(e) => setCustomRange(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-400">
                  Specify page numbers separated by commas or ranges with hyphens.
                </span>
              </div>
            )}

            {isProcessing && (
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                <Progress value={progressPercent} label={progressStatus} size="md" />
              </div>
            )}

            {!isProcessing && renderedImages.length === 0 && (
              <Button
                variant="primary"
                size="lg"
                leftIcon={<ShieldCheck className="w-5 h-5" />}
                onClick={handleRender}
                className="w-full justify-center"
              >
                Convert to JPG Images
              </Button>
            )}

            {renderedImages.length > 0 && !isProcessing && (
              <div className="flex flex-col gap-6 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-semibold">
                      Successfully converted {renderedImages.length} page(s) to JPG
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={handleDownloadAllZip}
                  >
                    Download All as ZIP
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {renderedImages.map((img, idx) => (
                    <div
                      key={img.pageNumber}
                      className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 flex flex-col items-center gap-2.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="w-full aspect-[1/1.4] bg-white rounded-lg overflow-hidden flex items-center justify-center border border-slate-700/50 shadow-sm">
                        <img
                          src={img.dataUrl}
                          alt={`Page ${img.pageNumber}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between w-full pt-1">
                        <span className="font-mono text-xs text-slate-400">Page {img.pageNumber}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadSingle(idx)}
                          leftIcon={<Download className="w-3.5 h-3.5" />}
                        >
                          JPG
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <ToolSEOContent
          toolName="PDF to JPG Converter"
          headline="Convert PDF Pages to Crisp JPG Images Online"
          subheadline="Fast, 100% private in-browser image extraction with customizable DPI and quality."
          steps={[
            {
              title: 'Upload Your PDF',
              description: 'Select your PDF document or drag and drop it into the conversion workstation.',
            },
            {
              title: 'Customize Image Options',
              description: 'Choose your desired resolution (72, 150, or 300 DPI) and JPEG compression quality.',
            },
            {
              title: 'Save JPG Photos',
              description: 'Instantly download individual JPG page images or package all converted pages into a single ZIP archive.',
            },
          ]}
          features={[
            {
              title: 'Crisp Vector Rendering',
              description: 'Uses PDF.js rendering pipeline to render text, vector curves, and raster imagery at ultra-high DPI.',
            },
            {
              title: 'Complete Device Privacy',
              description: 'Zero bytes leave your computer. The entire image extraction runs in client-side HTML5 canvas and Web Workers.',
            },
            {
              title: 'Batch & Range Extraction',
              description: 'Export all pages at once or target specific page ranges without extracting the entire document.',
            },
          ]}
          faqs={[
            {
              question: 'What is the best DPI to convert PDF to JPG?',
              answer: 'For screen viewing and social media, 150 DPI provides an ideal balance between razor-sharp clarity and compact file size. For high-resolution printing or archive purposes, select 300 DPI.',
            },
            {
              question: 'Does DocuLoom store my uploaded PDFs or extracted JPGs?',
              answer: 'No. DocuLoom runs 100% in your local web browser. Your confidential files never touch any external server or cloud service.',
            },
            {
              question: 'Can I convert multi-page PDFs to JPG all at once?',
              answer: 'Yes. Every page is converted into a separate JPG picture, and you can download them all together in a single convenient ZIP file with one click.',
            },
          ]}
          relatedToolIds={['jpg-to-pdf', 'pdf-to-images', 'compress-pdf', 'pdf-editor', 'pdf-to-word']}
        />
      </main>
    </div>
  );
};
