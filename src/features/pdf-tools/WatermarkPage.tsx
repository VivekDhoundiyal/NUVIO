import React, { useState, useEffect, useRef, useCallback } from 'react';
import { saveAs } from 'file-saver';
import {
  Stamp,
  ShieldCheck,
  Type,
  Image as ImageIcon,
  Upload,
  Eye
} from 'lucide-react';
import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { ValidationModal } from '../../components/validation/ValidationModal';
import type { ValidationReport } from '../../types/document';
import { StorageService } from '../../services/storage/db';
import { FileSessionStore } from '../../services/storage/fileSessionStore';

type PositionPreset = 'center' | 'diagonal' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
type PageFilterType = 'all' | 'odd' | 'even' | 'custom';

export const WatermarkPage: React.FC = () => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);

  // Watermark mode & configuration
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [textColor, setTextColor] = useState('#dc2626');
  const [fontSize, setFontSize] = useState(48);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(200);

  const [position, setPosition] = useState<PositionPreset>('diagonal');
  const [angle, setAngle] = useState(45);
  const [opacity, setOpacity] = useState(0.25);

  const [pageFilter, setPageFilter] = useState<PageFilterType>('all');
  const [customRange, setCustomRange] = useState('1');

  // Preview & Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [watermarkedBytes, setWatermarkedBytes] = useState<Uint8Array | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      const buffer = await f.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setFile(f);
      setPdfBytes(uint8);
      setWatermarkedBytes(null);

      const info = await PdfEngine.getPdfInfo(uint8, f.name);
      setPageCount(info.pages.length);
      setCustomRange(`1-${info.pages.length}`);

      await StorageService.logToolUsage('watermark-pdf');
      toast.success('Document loaded', `${f.name} (${info.pages.length} pages)`);
    } catch (e: any) {
      toast.error('Failed to load file', e.message);
    }
  }, [toast]);

  const hasLoadedSessionRef = useRef(false);

  // Auto-load file from active session
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      toast.success('Watermark image loaded', imgFile.name);
    };
    reader.readAsDataURL(imgFile);
  };

  const handlePositionChange = (pos: PositionPreset) => {
    setPosition(pos);
    if (pos === 'diagonal') {
      setAngle(45);
    } else {
      setAngle(0);
    }
  };

  // Live preview rendering
  const renderPreview = useCallback(async () => {
    if (!pdfBytes || !previewCanvasRef.current) return;
    try {
      const docProxy = await PdfEngine.loadPdfJsDoc(pdfBytes);
      const page = await docProxy.getPage(1);
      const viewport = page.getViewport({ scale: 0.6 });

      const canvas = previewCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Draw watermark overlay in live preview
      ctx.save();
      ctx.globalAlpha = opacity;

      if (watermarkType === 'text') {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fontSize * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const drawRotatedText = (x: number, y: number) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((-angle * Math.PI) / 180);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        };

        if (position === 'tile') {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              drawRotatedText(
                (canvas.width / 3) * c + canvas.width / 6,
                (canvas.height / 3) * r + canvas.height / 6
              );
            }
          }
        } else if (position === 'top-left') {
          drawRotatedText(40, 40);
        } else if (position === 'top-right') {
          drawRotatedText(canvas.width - 40, 40);
        } else if (position === 'bottom-left') {
          drawRotatedText(40, canvas.height - 40);
        } else if (position === 'bottom-right') {
          drawRotatedText(canvas.width - 40, canvas.height - 40);
        } else {
          // center / diagonal
          drawRotatedText(canvas.width / 2, canvas.height / 2);
        }
      } else if (watermarkType === 'image' && imageDataUrl) {
        const img = new Image();
        img.src = imageDataUrl;
        img.onload = () => {
          const scaledW = imageWidth * 0.6;
          const scaledH = scaledW * (img.height / img.width);

          const drawRotatedImg = (x: number, y: number) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((-angle * Math.PI) / 180);
            ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
            ctx.restore();
          };

          if (position === 'tile') {
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                drawRotatedImg(
                  (canvas.width / 3) * c + canvas.width / 6,
                  (canvas.height / 3) * r + canvas.height / 6
                );
              }
            }
          } else if (position === 'top-left') {
            drawRotatedImg(scaledW / 2 + 20, scaledH / 2 + 20);
          } else if (position === 'top-right') {
            drawRotatedImg(canvas.width - scaledW / 2 - 20, scaledH / 2 + 20);
          } else if (position === 'bottom-left') {
            drawRotatedImg(scaledW / 2 + 20, canvas.height - scaledH / 2 - 20);
          } else if (position === 'bottom-right') {
            drawRotatedImg(canvas.width - scaledW / 2 - 20, canvas.height - scaledH / 2 - 20);
          } else {
            drawRotatedImg(canvas.width / 2, canvas.height / 2);
          }
          ctx.restore();
        };
      }
      ctx.restore();
    } catch (e) {
      console.warn('Live preview error', e);
    }
  }, [pdfBytes, watermarkType, text, textColor, fontSize, imageDataUrl, imageWidth, position, angle, opacity]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleApply = async () => {
    if (!pdfBytes || !file) return;
    setIsProcessing(true);

    try {
      const colorNum = parseInt(textColor.replace('#', ''), 16);
      const color = isNaN(colorNum)
        ? { r: 0.8, g: 0.1, b: 0.1 }
        : {
            r: ((colorNum >> 16) & 255) / 255,
            g: ((colorNum >> 8) & 255) / 255,
            b: (colorNum & 255) / 255,
          };

      const result = await PdfEngine.addWatermark(pdfBytes, {
        type: watermarkType,
        text: watermarkType === 'text' ? text : undefined,
        imageDataUrl: watermarkType === 'image' ? (imageDataUrl ?? undefined) : undefined,
        fontSize,
        imageWidth,
        opacity,
        rotationAngle: angle,
        color,
        position,
        pageFilter: pageFilter === 'custom' ? customRange : pageFilter,
      });

      setWatermarkedBytes(result);

      // Automated quality validation
      const report = await ValidationEngine.validatePdfOutput(result, {
        operationName: 'Watermark PDF',
        originalSizeBytes: file.size,
      });

      setValidationReport(report);
      setIsModalOpen(true);
      toast.success('Watermark successfully applied', `Applied to ${file.name}`);
    } catch (e: any) {
      toast.error('Watermark application failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!watermarkedBytes || !file) return;
    const base = file.name.replace(/\.pdf$/i, '');
    const outName = `${base}-watermarked.pdf`;
    saveAs(new Blob([watermarkedBytes as any], { type: 'application/pdf' }), outName);
    toast.success('Download started', outName);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div className="text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3 shadow-subtle">
          <Stamp className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-950 dark:text-ink-50">Watermark PDF</h1>
        <p className="text-xs sm:text-sm text-ink-600 dark:text-ink-400 mt-1">
          Apply text or logo watermarks across document pages with live visual preview and exact positioning.
        </p>
      </div>

      {!file ? (
        <div className="max-w-2xl mx-auto w-full">
          <FileDropzone
            onFilesSelected={handleFileSelected}
            accept=".pdf,application/pdf"
            title="Upload PDF to Watermark"
            description="Drag and drop or browse from your device • 100% Client-Side"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Column (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-ink-900 border border-paper-300 dark:border-ink-800 rounded-3xl p-6 sm:p-8 shadow-paper flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-paper-200 dark:border-ink-800">
              <div>
                <h3 className="text-sm font-bold text-ink-950 dark:text-ink-50">{file.name}</h3>
                <p className="text-xs text-ink-500 font-mono mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB • {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setPdfBytes(null);
                  setWatermarkedBytes(null);
                  FileSessionStore.clear();
                }}
              >
                Change File
              </Button>
            </div>

            {/* Type selector: Text vs Image */}
            <div className="flex rounded-xl border border-paper-300 dark:border-ink-800 p-1 bg-paper-100 dark:bg-ink-950">
              <button
                type="button"
                onClick={() => setWatermarkType('text')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  watermarkType === 'text'
                    ? 'bg-white dark:bg-ink-800 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-ink-600 dark:text-ink-400 hover:text-ink-950'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Text Watermark</span>
              </button>
              <button
                type="button"
                onClick={() => setWatermarkType('image')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  watermarkType === 'image'
                    ? 'bg-white dark:bg-ink-800 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-ink-600 dark:text-ink-400 hover:text-ink-950'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Image / Logo</span>
              </button>
            </div>

            {/* Mode-specific settings */}
            {watermarkType === 'text' ? (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1.5">
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL, DRAFT, COPY"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-paper-300 dark:border-ink-800 bg-paper-50 dark:bg-ink-950 text-ink-950 dark:text-ink-50 font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1">
                      Font Size: {fontSize}pt
                    </label>
                    <input
                      type="range"
                      min={18}
                      max={96}
                      step={2}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-brand-600"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1">
                      Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-10 h-8 p-0.5 rounded-lg border border-paper-300 dark:border-ink-800 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-ink-600">{textColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1.5">
                    Logo / Stamp Image
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-paper-300 dark:border-ink-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-500 transition-colors bg-paper-50 dark:bg-ink-950/60"
                  >
                    {imageDataUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={imageDataUrl}
                          alt="Watermark preview"
                          className="w-16 h-16 object-contain rounded-lg border border-paper-300 dark:border-ink-800 bg-white"
                        />
                        <div className="text-left">
                          <span className="font-bold text-ink-900 dark:text-ink-100 block">
                            Image Loaded
                          </span>
                          <span className="text-[11px] text-brand-600 underline">
                            Click to replace image
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-ink-400" />
                        <span className="font-medium text-ink-700 dark:text-ink-300">
                          Click to select PNG or JPG logo
                        </span>
                        <span className="text-[11px] text-ink-400">
                          Transparent PNG recommended for clean watermarking
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1">
                    Image Width: {imageWidth}pt
                  </label>
                  <input
                    type="range"
                    min={60}
                    max={450}
                    step={10}
                    value={imageWidth}
                    onChange={(e) => setImageWidth(Number(e.target.value))}
                    className="w-full accent-brand-600"
                  />
                </div>
              </div>
            )}

            {/* Position presets */}
            <div className="flex flex-col gap-2 text-xs">
              <label className="font-semibold text-ink-800 dark:text-ink-200">
                Position Preset
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[
                  { id: 'diagonal', label: 'Diagonal 45°' },
                  { id: 'center', label: 'Center' },
                  { id: 'tile', label: 'Tile / Grid' },
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                  { id: 'bottom-right', label: 'Bottom Right' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePositionChange(p.id as PositionPreset)}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      position === p.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 shadow-xs'
                        : 'border-paper-300 dark:border-ink-800 hover:bg-paper-100 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Angle & Opacity */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1">
                  Rotation: {angle}°
                </label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </div>

              <div>
                <label className="font-semibold text-ink-800 dark:text-ink-200 block mb-1">
                  Opacity: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={0.9}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
              </div>
            </div>

            {/* Target pages */}
            <div className="flex flex-col gap-2 text-xs pt-3 border-t border-paper-200 dark:border-ink-800">
              <label className="font-semibold text-ink-800 dark:text-ink-200">
                Apply Watermark To Pages
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'all', label: `All (${pageCount})` },
                  { id: 'odd', label: 'Odd Pages' },
                  { id: 'even', label: 'Even Pages' },
                  { id: 'custom', label: 'Custom Range' },
                ].map((filt) => (
                  <button
                    key={filt.id}
                    type="button"
                    onClick={() => setPageFilter(filt.id as PageFilterType)}
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pageFilter === filt.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 shadow-xs'
                        : 'border-paper-300 dark:border-ink-800 hover:bg-paper-100 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300'
                    }`}
                  >
                    {filt.label}
                  </button>
                ))}
              </div>

              {pageFilter === 'custom' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="e.g. 1-3, 5, 8"
                    className="w-full px-3 py-2 rounded-xl border border-paper-300 dark:border-ink-800 bg-paper-50 dark:bg-ink-950 text-ink-950 dark:text-ink-50 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <p className="text-[10px] text-ink-500 mt-1">Specify comma-separated page numbers or ranges (e.g. 1-3, 5).</p>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <Button
              variant="primary"
              size="lg"
              isLoading={isProcessing}
              disabled={watermarkType === 'image' && !imageDataUrl}
              leftIcon={<ShieldCheck className="w-5 h-5" />}
              onClick={handleApply}
              className="mt-2"
            >
              Apply Watermark & Validate PDF
            </Button>
          </div>

          {/* Live Preview Canvas Column (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-ink-900 border border-paper-300 dark:border-ink-800 rounded-3xl p-6 shadow-paper flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-paper-200 dark:border-ink-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink-800 dark:text-ink-200">
                  Live Page Preview
                </span>
              </div>
              <span className="text-[11px] text-ink-500 font-mono">Page 1</span>
            </div>

            <div className="w-full aspect-[1/1.4] bg-paper-100 dark:bg-ink-950 rounded-2xl border border-paper-300 dark:border-ink-800 flex items-center justify-center overflow-hidden p-2">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain shadow-paper rounded bg-white"
              />
            </div>

            <p className="text-[11px] text-ink-500 text-center">
              Watermark positions and opacity update live. Click "Apply Watermark" to render to document.
            </p>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={validationReport}
        onConfirmDownload={handleDownload}
        downloadLabel="Download Watermarked PDF"
      />
    </div>
  );
};
