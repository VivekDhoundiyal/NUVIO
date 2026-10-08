import React, { useRef } from 'react';
import {
  MousePointer,
  Type,
  PenTool,
  Highlighter,
  Underline,
  Strikethrough,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Pen,
  Stamp,
  Image as ImageIcon,
  Droplet,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  ShieldCheck,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Paintbrush,
  Plus,
  Baseline,
  Copy,
  ClipboardPaste,
  Trash2,
  CopyPlus,
} from 'lucide-react';
import { IconButton } from '../../components/ui/IconButton';
import { Button } from '../../components/ui/Button';

export type EditorToolMode =
  | 'select'
  | 'text'
  | 'draw'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow';

export interface TextStyleProps {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | string;
  fontStyle: 'normal' | 'italic';
  underline: boolean;
  strikethrough: boolean;
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'baseline' | 'super' | 'sub';
  letterSpacing?: number;
  lineHeight?: number;
  listType?: 'bullet' | 'number';
}

export interface EditorToolbarProps {
  toolMode: EditorToolMode;
  onSetToolMode: (mode: EditorToolMode) => void;
  onInsertTextBox?: () => void;
  onOpenSignatureModal: () => void;
  onOpenStampModal: () => void;
  onOpenWatermarkModal: () => void;
  onInsertImage: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onValidateAndExport: () => void;
  isExporting: boolean;

  // Rich Text Formatting Bar
  activeTextStyle?: TextStyleProps;
  onUpdateTextStyle?: (updates: Partial<TextStyleProps>) => void;
  onToggleList?: (type: 'bullet' | 'number') => void;
  isTextSelected?: boolean;
  isFormatPainterActive?: boolean;
  onToggleFormatPainter?: () => void;
  hasCopiedStyle?: boolean;

  // Clipboard & Object actions
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canCopy?: boolean;
  canPaste?: boolean;
  canDelete?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  toolMode,
  onSetToolMode,
  onInsertTextBox,
  onOpenSignatureModal,
  onOpenStampModal,
  onOpenWatermarkModal,
  onInsertImage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onValidateAndExport,
  isExporting,
  activeTextStyle,
  onUpdateTextStyle,
  isTextSelected,
  isFormatPainterActive,
  onToggleFormatPainter,
  hasCopiedStyle,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  canCopy,
  canPaste,
  canDelete,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textColorInputRef = useRef<HTMLInputElement>(null);
  const highlightColorInputRef = useRef<HTMLInputElement>(null);

  const defaultStyle: TextStyleProps = {
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontSize: 12,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    strikethrough: false,
    color: '#0f172a',
    backgroundColor: '',
    textAlign: 'left',
    verticalAlign: 'baseline',
    letterSpacing: 0,
    lineHeight: 1.2,
  };
  const currentStyle = activeTextStyle || defaultStyle;

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-slate-800">
      {/* 1. Main Action & Object Tools */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 gap-2 overflow-x-auto select-none">
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2">
        <IconButton
          size="sm"
          disabled={!canUndo}
          aria-label="Undo edit (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
        >
          <Undo2 className="w-4 h-4" />
        </IconButton>
        <IconButton
          size="sm"
          disabled={!canRedo}
          aria-label="Redo edit (Ctrl+Y)"
          title="Redo (Ctrl+Y)"
          onClick={onRedo}
        >
          <Redo2 className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Clipboard & Object Actions (Copy, Paste, Duplicate, Delete) */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2">
        <IconButton
          size="sm"
          disabled={!canCopy}
          aria-label="Copy (Ctrl+C)"
          title="Copy selected object (Ctrl+C)"
          onClick={onCopy}
        >
          <Copy className="w-4 h-4" />
        </IconButton>
        <IconButton
          size="sm"
          disabled={!canPaste}
          aria-label="Paste (Ctrl+V)"
          title="Paste object (Ctrl+V)"
          onClick={onPaste}
        >
          <ClipboardPaste className="w-4 h-4" />
        </IconButton>
        <IconButton
          size="sm"
          disabled={!canCopy}
          aria-label="Duplicate (Ctrl+D)"
          title="Duplicate selected object (Ctrl+D)"
          onClick={onDuplicate}
        >
          <CopyPlus className="w-4 h-4" />
        </IconButton>
        <IconButton
          size="sm"
          disabled={!canDelete}
          variant="danger"
          aria-label="Delete (Del)"
          title="Delete selected object (Del / Backspace)"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Main Annotation Tools */}
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
        <IconButton
          size="sm"
          isActive={toolMode === 'select'}
          aria-label="Selection Tool"
          title="Select / Move object"
          onClick={() => onSetToolMode('select')}
        >
          <MousePointer className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'text'}
          aria-label="Click-to-Type Text Tool"
          title="Click page to type text"
          onClick={() => onSetToolMode('text')}
        >
          <Type className="w-4 h-4" />
        </IconButton>

        {onInsertTextBox && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Type className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
            onClick={onInsertTextBox}
            title="Insert a movable, resizable text box"
          >
            Add Text Box
          </Button>
        )}

        <IconButton
          size="sm"
          isActive={toolMode === 'draw'}
          aria-label="Pencil / Draw"
          title="Freehand Draw"
          onClick={() => onSetToolMode('draw')}
        >
          <PenTool className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'highlight'}
          aria-label="Highlight text"
          title="Highlight tool"
          onClick={() => onSetToolMode('highlight')}
        >
          <Highlighter className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'underline'}
          aria-label="Underline text"
          title="Underline tool"
          onClick={() => onSetToolMode('underline')}
        >
          <Underline className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'strikethrough'}
          aria-label="Strikethrough text"
          title="Strikethrough tool"
          onClick={() => onSetToolMode('strikethrough')}
        >
          <Strikethrough className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'rectangle'}
          aria-label="Rectangle Shape"
          title="Add Rectangle"
          onClick={() => onSetToolMode('rectangle')}
        >
          <Square className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'circle'}
          aria-label="Circle Shape"
          title="Add Circle"
          onClick={() => onSetToolMode('circle')}
        >
          <Circle className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'line'}
          aria-label="Line Shape"
          title="Add Line"
          onClick={() => onSetToolMode('line')}
        >
          <Minus className="w-4 h-4" />
        </IconButton>

        <IconButton
          size="sm"
          isActive={toolMode === 'arrow'}
          aria-label="Arrow Shape"
          title="Add Arrow"
          onClick={() => onSetToolMode('arrow')}
        >
          <ArrowRight className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Inserts: Signature, Stamp, Image, Watermark */}
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Pen className="w-3.5 h-3.5" />}
          onClick={onOpenSignatureModal}
        >
          Signature
        </Button>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Stamp className="w-3.5 h-3.5" />}
          onClick={onOpenStampModal}
        >
          Stamp
        </Button>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<Droplet className="w-3.5 h-3.5" />}
          onClick={onOpenWatermarkModal}
        >
          Watermark
        </Button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onInsertImage(f);
            e.target.value = '';
          }}
        />
        <IconButton
          size="sm"
          aria-label="Insert Image"
          title="Insert Image"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImageIcon className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <IconButton
          size="sm"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={onZoomOut}
        >
          <ZoomOut className="w-4 h-4" />
        </IconButton>
        <button
          type="button"
          onClick={onZoomReset}
          className="text-xs font-mono font-medium px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton
          size="sm"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={onZoomIn}
        >
          <ZoomIn className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Save & Export */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="primary"
          size="sm"
          isLoading={isExporting}
          leftIcon={<ShieldCheck className="w-4 h-4" />}
          rightIcon={<Download className="w-4 h-4" />}
          onClick={onValidateAndExport}
        >
          Validate & Export
        </Button>
      </div>
      </div>

      {/* 2. Google Docs-style Rich Text Formatting Ribbon */}
      <div className="flex items-center px-4 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 gap-1.5 overflow-x-auto select-none text-xs">
        {/* Format Painter (Copy Formatting) */}
        <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700/60 pr-2">
          <button
            type="button"
            onClick={onToggleFormatPainter}
            title={
              isFormatPainterActive
                ? 'Format Painter Active: Click another text span to apply copied formatting'
                : hasCopiedStyle
                ? 'Format Painter (Copied formatting ready to paste)'
                : 'Format Painter: Copy formatting from selected text'
            }
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
              isFormatPainterActive
                ? 'bg-brand-600 text-white shadow-xs ring-2 ring-brand-400'
                : hasCopiedStyle
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Format Painter</span>
          </button>
        </div>

        {/* Font Family Dropdown */}
        <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700/60 pr-2">
          <select
            value={currentStyle.fontFamily}
            onChange={(e) => onUpdateTextStyle?.({ fontFamily: e.target.value })}
            className="h-7 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium cursor-pointer"
            title="Font Family"
          >
            <option value="Helvetica, Arial, sans-serif">Helvetica (Sans-Serif)</option>
            <option value="'Times New Roman', Times, serif">Times New Roman (Serif)</option>
            <option value="'Courier New', Courier, monospace">Courier (Monospace)</option>
          </select>
        </div>

        {/* Font Size: Stepper - / Input / Stepper + */}
        <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700/60 mr-1">
          <button
            type="button"
            onClick={() => onUpdateTextStyle?.({ fontSize: Math.max(6, Math.round(currentStyle.fontSize - 1)) })}
            className="w-6 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l transition-colors"
            title="Decrease font size"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min={6}
            max={96}
            value={Math.round(currentStyle.fontSize)}
            onChange={(e) => onUpdateTextStyle?.({ fontSize: Math.max(6, Math.min(96, Number(e.target.value) || 12)) })}
            className="w-10 h-7 text-center text-xs font-mono font-medium text-slate-800 dark:text-slate-200 bg-transparent border-x border-slate-200 dark:border-slate-700 focus:outline-none"
            title="Font Size (pt)"
          />
          <button
            type="button"
            onClick={() => onUpdateTextStyle?.({ fontSize: Math.min(96, Math.round(currentStyle.fontSize + 1)) })}
            className="w-6 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-r transition-colors"
            title="Increase font size"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Bold, Italic, Underline, Strikethrough */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700/60 pr-2">
          <IconButton
            size="sm"
            isActive={currentStyle.fontWeight === 'bold'}
            aria-label="Bold (Ctrl+B)"
            title="Bold"
            onClick={() =>
              onUpdateTextStyle?.({
                fontWeight: currentStyle.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
          >
            <Bold className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={currentStyle.fontStyle === 'italic'}
            aria-label="Italic (Ctrl+I)"
            title="Italic"
            onClick={() =>
              onUpdateTextStyle?.({
                fontStyle: currentStyle.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
          >
            <Italic className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={!!currentStyle.underline}
            aria-label="Underline (Ctrl+U)"
            title="Underline"
            onClick={() =>
              onUpdateTextStyle?.({
                underline: !currentStyle.underline,
              })
            }
          >
            <Underline className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={!!currentStyle.strikethrough}
            aria-label="Strikethrough"
            title="Strikethrough"
            onClick={() =>
              onUpdateTextStyle?.({
                strikethrough: !currentStyle.strikethrough,
              })
            }
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </IconButton>
        </div>

        {/* Text Color & Highlight Color Swatches */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700/60 pr-2">
          {/* Text Color Swatch */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => textColorInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-7 h-7 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title={`Text color: ${currentStyle.color}`}
            >
              <Baseline className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
              <span
                className="w-4 h-1 rounded-xs mt-0.5"
                style={{ backgroundColor: currentStyle.color || '#000000' }}
              />
            </button>
            <input
              ref={textColorInputRef}
              type="color"
              value={currentStyle.color || '#000000'}
              onChange={(e) => onUpdateTextStyle?.({ color: e.target.value })}
              className="sr-only"
            />
          </div>

          {/* Highlight Color Swatch */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => highlightColorInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-7 h-7 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title={`Highlight / Background color: ${currentStyle.backgroundColor || 'None'}`}
            >
              <Highlighter className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
              <span
                className="w-4 h-1 rounded-xs mt-0.5 border border-slate-300 dark:border-slate-600"
                style={{
                  backgroundColor: currentStyle.backgroundColor || 'transparent',
                }}
              />
            </button>
            <input
              ref={highlightColorInputRef}
              type="color"
              value={currentStyle.backgroundColor || '#ffea00'}
              onChange={(e) => onUpdateTextStyle?.({ backgroundColor: e.target.value })}
              className="sr-only"
            />
          </div>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700/60 pr-2">
          <IconButton
            size="sm"
            isActive={currentStyle.textAlign === 'left'}
            aria-label="Align left"
            title="Align Left"
            onClick={() => onUpdateTextStyle?.({ textAlign: 'left' })}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={currentStyle.textAlign === 'center'}
            aria-label="Align center"
            title="Align Center"
            onClick={() => onUpdateTextStyle?.({ textAlign: 'center' })}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={currentStyle.textAlign === 'right'}
            aria-label="Align right"
            title="Align Right"
            onClick={() => onUpdateTextStyle?.({ textAlign: 'right' })}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            isActive={currentStyle.textAlign === 'justify'}
            aria-label="Align justify"
            title="Justify"
            onClick={() => onUpdateTextStyle?.({ textAlign: 'justify' })}
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </IconButton>
        </div>

        {/* Selection Context Indicator */}
        <div className="ml-auto flex items-center gap-2">
          {isTextSelected ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              Editing Text
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic hidden sm:inline">
              Click any text to format
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
