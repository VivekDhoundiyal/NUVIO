import React, { useState, useRef } from 'react';
import { Check, Type, Image as ImageIcon, Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export interface WatermarkOptions {
  type: 'text' | 'image';
  text?: string;
  imageDataUrl?: string;
  opacity: number;
  rotation: number;
  position: 'diagonal' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  fontSize?: number;
  imageSize?: number;
  color?: string;
  targetPages: 'all' | 'current';
}

export interface WatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyWatermark: (options: WatermarkOptions) => void;
  activePageIndex?: number;
  pageCount?: number;
}

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  isOpen,
  onClose,
  onApplyWatermark,
  activePageIndex = 0,
  pageCount = 1,
}) => {
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(-45);
  const [position, setPosition] = useState<WatermarkOptions['position']>('diagonal');
  const [fontSize, setFontSize] = useState(54);
  const [imageSize, setImageSize] = useState(200);
  const [color, setColor] = useState('#dc2626');
  const [targetPages, setTargetPages] = useState<'all' | 'current'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePositionChange = (pos: WatermarkOptions['position']) => {
    setPosition(pos);
    if (pos === 'diagonal') {
      setRotation(-45);
    } else {
      setRotation(0);
    }
  };

  const handleApply = () => {
    if (watermarkType === 'text' && !text.trim()) return;
    if (watermarkType === 'image' && !imageDataUrl) return;

    onApplyWatermark({
      type: watermarkType,
      text: watermarkType === 'text' ? text.trim() : undefined,
      imageDataUrl: watermarkType === 'image' ? (imageDataUrl ?? undefined) : undefined,
      opacity,
      rotation,
      position,
      fontSize,
      imageSize,
      color,
      targetPages,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Watermark"
      description="Apply a text or image watermark with custom opacity, rotation, and positioning."
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={watermarkType === 'image' && !imageDataUrl}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Apply Watermark
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Type Toggle: Text vs Image */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setWatermarkType('text')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${
              watermarkType === 'text'
                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text Watermark</span>
          </button>
          <button
            type="button"
            onClick={() => setWatermarkType('image')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-all ${
              watermarkType === 'image'
                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image / Logo Watermark</span>
          </button>
        </div>

        {/* Text specific inputs */}
        {watermarkType === 'text' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Watermark Text
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. CONFIDENTIAL, DRAFT, COPY"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold uppercase tracking-wider"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Font Size ({fontSize}pt)
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
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Text Color
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-8 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Image specific inputs */}
        {watermarkType === 'image' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Watermark Image / Logo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-500 transition-colors bg-slate-50 dark:bg-slate-900/40"
              >
                {imageDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={imageDataUrl}
                      alt="Watermark preview"
                      className="w-16 h-16 object-contain rounded border border-slate-200 dark:border-slate-700"
                    />
                    <div className="text-left">
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        Image Loaded
                      </span>
                      <span className="text-[11px] text-brand-600 hover:underline">
                        Click to change image
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Click to upload PNG or JPG logo
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Transparent PNGs work best for watermarks
                    </span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Image Width ({imageSize}pt)
              </label>
              <input
                type="range"
                min={60}
                max={450}
                step={10}
                value={imageSize}
                onChange={(e) => setImageSize(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>
          </div>
        )}

        {/* Position presets */}
        <div>
          <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Position
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'diagonal', label: 'Diagonal' },
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
                onClick={() => handlePositionChange(p.id as any)}
                className={`py-1.5 px-2 rounded-md border text-center font-medium transition-all ${
                  position === p.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity & Rotation */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Rotation: {rotation}°
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
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

        {/* Target Pages */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Apply Watermark To
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetPages('all')}
              className={`py-1.5 px-3 rounded-md border text-center font-medium transition-all ${
                targetPages === 'all'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              All Pages ({pageCount} {pageCount === 1 ? 'page' : 'pages'})
            </button>
            <button
              type="button"
              onClick={() => setTargetPages('current')}
              className={`py-1.5 px-3 rounded-md border text-center font-medium transition-all ${
                targetPages === 'current'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Current Page (Page {activePageIndex + 1})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
