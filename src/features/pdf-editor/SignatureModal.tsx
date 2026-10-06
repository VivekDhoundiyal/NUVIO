import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Type, Upload, Trash2, Check, Undo, Sparkles } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { StorageService } from '../../services/storage/db';

export interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSignature: (dataUrl: string) => void;
}

interface SignatureStyleOption {
  id: string;
  name: string;
  fontFamily: string;
  cssStyle?: React.CSSProperties;
}

const SIGNATURE_STYLES: SignatureStyleOption[] = [
  { id: 'elegant', name: 'Elegant Script', fontFamily: "'Great Vibes', 'Brush Script MT', cursive" },
  { id: 'calligraphy', name: 'Formal Calligraphy', fontFamily: "'Allura', 'Snell Roundhand', cursive" },
  { id: 'executive', name: 'Executive Cursive', fontFamily: "'Alex Brush', 'Apple Chancery', cursive" },
  { id: 'modern', name: 'Modern Hand', fontFamily: "'Caveat', 'Segoe Script', cursive" },
  { id: 'bold', name: 'Bold Script', fontFamily: "'Dancing Script', 'Brush Script MT', cursive" },
  { id: 'minimalist', name: 'Minimalist Line', fontFamily: "'Sacramento', cursive" },
  { id: 'classic', name: 'Classic Heritage', fontFamily: "'Parisienne', 'Edwardian Script ITC', cursive" },
  { id: 'casual', name: 'Casual Flow', fontFamily: "'Satisfy', cursive" },
  { id: 'artistic', name: 'Artistic Flourish', fontFamily: "'Marck Script', cursive" },
  { id: 'corporate', name: 'Corporate Formal', fontFamily: "'Courgette', serif" },
  { id: 'smooth', name: 'Smooth Signature', fontFamily: "'Yellowtail', cursive" },
  { id: 'playball', name: 'Athletic Signature', fontFamily: "'Playball', cursive" },
  { id: 'lucida', name: 'Monogram Style', fontFamily: "'Lucida Handwriting', cursive" },
  { id: 'jot', name: 'Quick Jotting', fontFamily: "'Segoe Print', cursive" },
  { id: 'prestige', name: 'Prestige Executive', fontFamily: "'Times New Roman', serif, italic" },
  { id: 'heritage', name: 'Heritage Serif', fontFamily: "'Georgia', serif, italic" },
];

const PRESET_COLORS = [
  { name: 'Obsidian Black', value: '#0f172a' },
  { name: 'Dark Navy', value: '#1e3a8a' },
  { name: 'Royal Blue', value: '#2563eb' },
  { name: 'Crimson Red', value: '#dc2626' },
  { name: 'Forest Green', value: '#15803d' },
];

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onInsertSignature,
}) => {
  const [activeTab, setActiveTab] = useState<'type' | 'draw' | 'upload'>('type');
  const [signatureColor, setSignatureColor] = useState('#0f172a');
  const [isCustomColor, setIsCustomColor] = useState(false);

  // Type Signature state
  const [typedName, setTypedName] = useState('Vivek Dhoundiyal');
  const [selectedStyleId, setSelectedStyleId] = useState('elegant');

  // Draw Signature state
  const [penWidth, setPenWidth] = useState(3);
  const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Upload Signature state
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);

  // Setup drawing canvas context
  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.strokeStyle = signatureColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen, activeTab, signatureColor, penWidth]);

  // Drawing Canvas Methods
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHistory([]);
  };

  const undoDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || drawHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...drawHistory];
    newHistory.pop(); // Remove current
    const previous = newHistory[newHistory.length - 1];

    if (previous) {
      ctx.putImageData(previous, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDrawHistory(newHistory);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save state for undo
    setDrawHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // Generate crisp typed signature data URL
  const generateTypedSignatureDataUrl = (styleOption: SignatureStyleOption): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = signatureColor;
    ctx.font = `italic 54px ${styleOption.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(typedName || 'Your Name', canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  };

  // Upload handler with transparent PNG extraction
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Draw to canvas and remove solid white background if any
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // If almost white, make transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Alpha 0
          }
        }
        ctx.putImageData(imgData, 0, 0);
        setUploadedDataUrl(canvas.toDataURL('image/png'));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Confirm and insert
  const handleInsert = async () => {
    let finalDataUrl = '';

    if (activeTab === 'type') {
      const selectedOption = SIGNATURE_STYLES.find((s) => s.id === selectedStyleId) || SIGNATURE_STYLES[0];
      finalDataUrl = generateTypedSignatureDataUrl(selectedOption);
    } else if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      finalDataUrl = canvas.toDataURL('image/png');
    } else if (activeTab === 'upload') {
      if (!uploadedDataUrl) return;
      finalDataUrl = uploadedDataUrl;
    }

    if (!finalDataUrl) return;

    // Save to IndexedDB for quick reuse
    await StorageService.saveSignature({
      id: `sig-${Date.now()}`,
      name: typedName || 'Signature',
      dataUrl: finalDataUrl,
      createdAt: Date.now(),
    });

    onInsertSignature(finalDataUrl);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Professional Signature Studio" maxWidth="2xl">
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <Tabs
          tabs={[
            { id: 'type', label: 'Type Signature', icon: <Type className="w-4 h-4" /> },
            { id: 'draw', label: 'Draw with Pen', icon: <PenTool className="w-4 h-4" /> },
            { id: 'upload', label: 'Upload Image', icon: <Upload className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
        />

        {/* Global Color Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Signature Ink Color:
          </span>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setSignatureColor(c.value);
                  setIsCustomColor(false);
                }}
                title={c.name}
                aria-label={c.name}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  signatureColor === c.value && !isCustomColor
                    ? 'border-brand-500 scale-110 shadow-xs'
                    : 'border-white dark:border-slate-700 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            {/* Custom Color Picker */}
            <label
              title="Custom Color"
              className="relative w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 cursor-pointer overflow-hidden flex items-center justify-center bg-conic-gradient hover:scale-105 transition-transform"
            >
              <input
                type="color"
                value={signatureColor}
                onChange={(e) => {
                  setSignatureColor(e.target.value);
                  setIsCustomColor(true);
                }}
                className="opacity-0 absolute inset-0 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* TAB 1: TYPE SIGNATURE */}
        {activeTab === 'type' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name / Signer Text
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name (e.g. Vivek Dhoundiyal)..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            {/* Signature Styles Grid (16 Styles) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Signature Style (16 Distinct Variations)
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-brand-500" />
                  Live SVG preview
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {SIGNATURE_STYLES.map((style) => {
                  const isSelected = selectedStyleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyleId(style.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 ring-2 ring-brand-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="text-2xl sm:text-3xl my-1 truncate max-w-full px-2"
                        style={{
                          fontFamily: style.fontFamily,
                          color: signatureColor,
                        }}
                      >
                        {typedName || 'Signature'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 font-medium">
                        {style.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DRAW SIGNATURE */}
        {activeTab === 'draw' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Draw your signature using mouse, stylus, or finger touch</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600 dark:text-slate-300">Pen Size:</span>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={penWidth}
                  onChange={(e) => setPenWidth(Number(e.target.value))}
                  className="w-20 accent-brand-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={600}
                height={220}
                className="w-full h-52 block cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="h-0.5 w-40 bg-slate-300/60 dark:bg-slate-700/60" />
                <span className="text-[11px] text-slate-400 font-mono">Sign on the line</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undoDraw}
                disabled={drawHistory.length === 0}
                leftIcon={<Undo className="w-3.5 h-3.5" />}
              >
                Undo Stroke
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
              >
                Clear Canvas
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: UPLOAD IMAGE */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileUpload}
                className="hidden"
                id="signature-file-upload"
              />
              <label
                htmlFor="signature-file-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to select signature image
                </div>
                <p className="text-xs text-slate-500">
                  PNG, JPG, or WebP. Solid white backgrounds will be automatically converted to transparent.
                </p>
              </label>
            </div>

            {uploadedDataUrl && (
              <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <img
                  src={uploadedDataUrl}
                  alt="Uploaded Signature Preview"
                  className="max-h-28 object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInsert}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Insert Signature into Document
          </Button>
        </div>
      </div>
    </Modal>
  );
};
