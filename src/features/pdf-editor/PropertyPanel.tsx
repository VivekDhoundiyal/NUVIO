import React from 'react';
import {
  Trash2,
  Copy,
  RotateCw,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Type,
  List,
  ListOrdered,
  Superscript,
  Subscript,
} from 'lucide-react';
import type { AnnotationObject, EditableTextSpan } from '../../types/document';
import { IconButton } from '../../components/ui/IconButton';
import { toggleListFormatting } from '../../utils/pdfSanitize';

export interface PropertyPanelProps {
  selectedObject: AnnotationObject | null;
  selectedSpan?: EditableTextSpan | null;
  onUpdateObject: (updated: Partial<AnnotationObject>) => void;
  onUpdateSpan?: (updated: Partial<EditableTextSpan>) => void;
  onDeleteObject: () => void;
  onDuplicateObject: () => void;
  onResetSpan?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedObject,
  selectedSpan,
  onUpdateObject,
  onUpdateSpan,
  onDeleteObject,
  onDuplicateObject,
  onResetSpan,
  onBringForward,
  onSendBackward,
}) => {
  if (!selectedObject && !selectedSpan) {
    return null;
  }

  // If a PDF text span is selected
  if (selectedSpan) {
    return (
      <div className="w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4 text-xs overflow-y-auto shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              PDF Text Span
            </span>
            {selectedSpan.pdfFontName && (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[140px]" title={`Internal PDF Font: ${selectedSpan.pdfFontName}`}>
                {selectedSpan.pdfFontName}
              </span>
            )}
          </div>
          {onResetSpan && selectedSpan.isModified && (
            <button
              type="button"
              onClick={onResetSpan}
              title="Revert to original PDF text and style"
              className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Text Content */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-slate-700 dark:text-slate-300 block">
            Text Content
          </label>
          <textarea
            rows={2}
            value={selectedSpan.currentText}
            onChange={(e) =>
              onUpdateSpan?.({
                currentText: e.target.value,
                isModified: true,
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
          />
          {selectedSpan.isModified && (
            <span className="text-[10px] text-slate-400 truncate">
              Original: &quot;{selectedSpan.originalText}&quot;
            </span>
          )}
        </div>

        {/* Font Family */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="font-medium text-slate-700 dark:text-slate-300 block">
            Font Family
          </label>
          <select
            value={selectedSpan.fontFamily || 'Helvetica, Arial, sans-serif'}
            onChange={(e) => onUpdateSpan?.({ fontFamily: e.target.value, isModified: true })}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="Helvetica, Arial, sans-serif">Helvetica (Sans-Serif)</option>
            <option value="'Times New Roman', Times, serif">Times New Roman (Serif)</option>
            <option value="'Courier New', Courier, monospace">Courier (Monospace)</option>
            <option value="Georgia, serif">Georgia (Serif)</option>
            <option value="Garamond, serif">Garamond (Serif)</option>
            <option value="Verdana, sans-serif">Verdana (Sans-Serif)</option>
          </select>
        </div>

        {/* Font Size & Colors */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Size ({Math.round(selectedSpan.fontSize)}pt)
            </label>
            <input
              type="number"
              min={6}
              max={96}
              value={Math.round(selectedSpan.fontSize)}
              onChange={(e) =>
                onUpdateSpan?.({
                  fontSize: Number(e.target.value) || 12,
                  isModified: true,
                })
              }
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
            />
          </div>
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Text Color
            </label>
            <input
              type="color"
              value={selectedSpan.color || '#000000'}
              onChange={(e) => onUpdateSpan?.({ color: e.target.value, isModified: true })}
              className="w-full h-7 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Mask Background Color */}
        <div>
          <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
            Background / Mask Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedSpan.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdateSpan?.({ backgroundColor: e.target.value, isModified: true })}
              className="w-8 h-7 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
            />
            <span className="text-[11px] text-slate-500 font-mono">
              {selectedSpan.backgroundColor || '#ffffff'}
            </span>
          </div>
        </div>

        {/* Character Spacing */}
        <div>
          <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
            Character Spacing ({selectedSpan.letterSpacing || 0}pt)
          </label>
          <input
            type="range"
            min={0}
            max={6}
            step={0.5}
            value={selectedSpan.letterSpacing || 0}
            onChange={(e) =>
              onUpdateSpan?.({
                letterSpacing: Number(e.target.value),
                isModified: true,
              })
            }
            className="w-full accent-brand-600 cursor-pointer"
          />
        </div>

        {/* Formatting Toggles */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="font-medium text-slate-700 dark:text-slate-300 block">
            Style & Formatting
          </label>
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              isActive={selectedSpan.fontWeight === 'bold'}
              aria-label="Toggle bold"
              onClick={() =>
                onUpdateSpan?.({
                  fontWeight: selectedSpan.fontWeight === 'bold' ? 'normal' : 'bold',
                  isModified: true,
                })
              }
            >
              <Bold className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.fontStyle === 'italic'}
              aria-label="Toggle italic"
              onClick={() =>
                onUpdateSpan?.({
                  fontStyle: selectedSpan.fontStyle === 'italic' ? 'normal' : 'italic',
                  isModified: true,
                })
              }
            >
              <Italic className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={!!selectedSpan.underline}
              aria-label="Toggle underline"
              onClick={() =>
                onUpdateSpan?.({
                  underline: !selectedSpan.underline,
                  isModified: true,
                })
              }
            >
              <Underline className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={!!selectedSpan.strikethrough}
              aria-label="Toggle strikethrough"
              onClick={() =>
                onUpdateSpan?.({
                  strikethrough: !selectedSpan.strikethrough,
                  isModified: true,
                })
              }
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.verticalAlign === 'super'}
              aria-label="Superscript"
              title="Superscript (X²)"
              onClick={() =>
                onUpdateSpan?.({
                  verticalAlign: selectedSpan.verticalAlign === 'super' ? 'baseline' : 'super',
                  isModified: true,
                })
              }
            >
              <Superscript className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.verticalAlign === 'sub'}
              aria-label="Subscript"
              title="Subscript (X₂)"
              onClick={() =>
                onUpdateSpan?.({
                  verticalAlign: selectedSpan.verticalAlign === 'sub' ? 'baseline' : 'sub',
                  isModified: true,
                })
              }
            >
              <Subscript className="w-3.5 h-3.5" />
            </IconButton>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <IconButton
              size="sm"
              isActive={selectedSpan.textAlign === 'left' || !selectedSpan.textAlign}
              aria-label="Align left"
              onClick={() => onUpdateSpan?.({ textAlign: 'left', isModified: true })}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.textAlign === 'center'}
              aria-label="Align center"
              onClick={() => onUpdateSpan?.({ textAlign: 'center', isModified: true })}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.textAlign === 'right'}
              aria-label="Align right"
              onClick={() => onUpdateSpan?.({ textAlign: 'right', isModified: true })}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.textAlign === 'justify'}
              aria-label="Align justify"
              onClick={() => onUpdateSpan?.({ textAlign: 'justify', isModified: true })}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </IconButton>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <IconButton
              size="sm"
              isActive={selectedSpan.listType === 'bullet'}
              aria-label="Bulleted list"
              title="Bulleted List"
              onClick={() => {
                const nextText = toggleListFormatting(selectedSpan.currentText, 'bullet');
                onUpdateSpan?.({
                  currentText: nextText,
                  listType: selectedSpan.listType === 'bullet' ? undefined : 'bullet',
                  isModified: true,
                });
              }}
            >
              <List className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedSpan.listType === 'number'}
              aria-label="Numbered list"
              title="Numbered List"
              onClick={() => {
                const nextText = toggleListFormatting(selectedSpan.currentText, 'number');
                onUpdateSpan?.({
                  currentText: nextText,
                  listType: selectedSpan.listType === 'number' ? undefined : 'number',
                  isModified: true,
                });
              }}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>

        {/* Position & Size Editing */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
            Position & Size (pt)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">X Position</label>
              <input
                type="number"
                value={Math.round(selectedSpan.x)}
                onChange={(e) => onUpdateSpan?.({ x: Number(e.target.value), isModified: true })}
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Y Position</label>
              <input
                type="number"
                value={Math.round(selectedSpan.y)}
                onChange={(e) => onUpdateSpan?.({ y: Number(e.target.value), isModified: true })}
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Width</label>
              <input
                type="number"
                min={10}
                value={Math.round(selectedSpan.width)}
                onChange={(e) => onUpdateSpan?.({ width: Math.max(10, Number(e.target.value)), isModified: true })}
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Height</label>
              <input
                type="number"
                min={10}
                value={Math.round(selectedSpan.height)}
                onChange={(e) => onUpdateSpan?.({ height: Math.max(10, Number(e.target.value)), isModified: true })}
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedObject) return null;

  const titleMap: Record<string, string> = {
    signature: 'Signature Properties',
    text: 'Text Properties',
    shape: 'Shape Properties',
    image: 'Image Properties',
    stamp: 'Stamp Properties',
    drawing: 'Drawing Properties',
    watermark: 'Watermark Properties',
    highlight: 'Highlight Properties',
    underline: 'Underline Properties',
    strikethrough: 'Strikethrough Properties',
  };

  const panelTitle = titleMap[selectedObject.type] || `${selectedObject.type} Properties`;

  return (
    <div className="w-64 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4 text-xs overflow-y-auto shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-[11px]">
          {panelTitle}
        </span>
        <div className="flex items-center gap-1">
          {onBringForward && (
            <IconButton
              size="sm"
              aria-label="Bring forward"
              title="Bring forward"
              onClick={onBringForward}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </IconButton>
          )}
          {onSendBackward && (
            <IconButton
              size="sm"
              aria-label="Send backward"
              title="Send backward"
              onClick={onSendBackward}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </IconButton>
          )}
          <IconButton
            size="sm"
            aria-label="Duplicate element"
            title="Duplicate"
            onClick={onDuplicateObject}
          >
            <Copy className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            variant="danger"
            aria-label="Delete element"
            title="Delete (Del)"
            onClick={onDeleteObject}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Geometry / Coordinates (X, Y, Width, Height) */}
      <div className="flex flex-col gap-2">
        <span className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
          Position & Size (pt)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">X Position</label>
            <input
              type="number"
              value={Math.round(selectedObject.x)}
              onChange={(e) => onUpdateObject({ x: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Y Position</label>
            <input
              type="number"
              value={Math.round(selectedObject.y)}
              onChange={(e) => onUpdateObject({ y: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Width</label>
            <input
              type="number"
              min={10}
              value={Math.round(selectedObject.width)}
              onChange={(e) => onUpdateObject({ width: Math.max(10, Number(e.target.value)) })}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Height</label>
            <input
              type="number"
              min={10}
              value={Math.round(selectedObject.height)}
              onChange={(e) => onUpdateObject({ height: Math.max(10, Number(e.target.value)) })}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Text specific properties */}
      {selectedObject.type === 'text' && (
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Text Content
            </label>
            <textarea
              rows={2}
              value={selectedObject.text || ''}
              onChange={(e) => onUpdateObject({ text: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Font Size ({selectedObject.fontSize || 14}pt)
              </label>
              <input
                type="range"
                min={8}
                max={48}
                value={selectedObject.fontSize || 14}
                onChange={(e) => onUpdateObject({ fontSize: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Color
              </label>
              <input
                type="color"
                value={selectedObject.textColor || '#0f172a'}
                onChange={(e) => onUpdateObject({ textColor: e.target.value })}
                className="w-full h-7 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 pt-1">
            <IconButton
              size="sm"
              isActive={selectedObject.fontWeight === 'bold'}
              aria-label="Toggle bold"
              onClick={() =>
                onUpdateObject({
                  fontWeight: selectedObject.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
            >
              <Bold className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.fontStyle === 'italic'}
              aria-label="Toggle italic"
              onClick={() =>
                onUpdateObject({
                  fontStyle: selectedObject.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
            >
              <Italic className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={!!selectedObject.underline}
              aria-label="Toggle underline"
              onClick={() =>
                onUpdateObject({
                  underline: !selectedObject.underline,
                })
              }
            >
              <Underline className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={!!selectedObject.strikethrough}
              aria-label="Toggle strikethrough"
              onClick={() =>
                onUpdateObject({
                  strikethrough: !selectedObject.strikethrough,
                })
              }
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.verticalAlign === 'super'}
              aria-label="Superscript"
              title="Superscript (X²)"
              onClick={() =>
                onUpdateObject({
                  verticalAlign: selectedObject.verticalAlign === 'super' ? 'baseline' : 'super',
                })
              }
            >
              <Superscript className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.verticalAlign === 'sub'}
              aria-label="Subscript"
              title="Subscript (X₂)"
              onClick={() =>
                onUpdateObject({
                  verticalAlign: selectedObject.verticalAlign === 'sub' ? 'baseline' : 'sub',
                })
              }
            >
              <Subscript className="w-3.5 h-3.5" />
            </IconButton>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <IconButton
              size="sm"
              isActive={selectedObject.textAlign === 'left'}
              aria-label="Align left"
              onClick={() => onUpdateObject({ textAlign: 'left' })}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.textAlign === 'center'}
              aria-label="Align center"
              onClick={() => onUpdateObject({ textAlign: 'center' })}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.textAlign === 'right'}
              aria-label="Align right"
              onClick={() => onUpdateObject({ textAlign: 'right' })}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.textAlign === 'justify'}
              aria-label="Align justify"
              onClick={() => onUpdateObject({ textAlign: 'justify' })}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </IconButton>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
            <IconButton
              size="sm"
              isActive={selectedObject.listType === 'bullet'}
              aria-label="Bulleted list"
              title="Bulleted List"
              onClick={() => {
                const nextText = toggleListFormatting(selectedObject.text || '', 'bullet');
                onUpdateObject({
                  text: nextText,
                  listType: selectedObject.listType === 'bullet' ? undefined : 'bullet',
                });
              }}
            >
              <List className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton
              size="sm"
              isActive={selectedObject.listType === 'number'}
              aria-label="Numbered list"
              title="Numbered List"
              onClick={() => {
                const nextText = toggleListFormatting(selectedObject.text || '', 'number');
                onUpdateObject({
                  text: nextText,
                  listType: selectedObject.listType === 'number' ? undefined : 'number',
                });
              }}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>
      )}

      {/* Shape, Highlight, Underline, Strikethrough specific properties */}
      {(selectedObject.type === 'shape' ||
        selectedObject.type === 'highlight' ||
        selectedObject.type === 'underline' ||
        selectedObject.type === 'strikethrough') && (
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                {selectedObject.type === 'highlight' ? 'Highlight Color' : 'Color'}
              </label>
              <input
                type="color"
                value={
                  selectedObject.strokeColor ||
                  selectedObject.fillColor ||
                  (selectedObject.type === 'highlight'
                    ? '#ffea00'
                    : selectedObject.type === 'strikethrough'
                    ? '#dc2626'
                    : '#2563eb')
                }
                onChange={(e) =>
                  onUpdateObject({
                    strokeColor: e.target.value,
                    fillColor: selectedObject.type === 'highlight' ? e.target.value : undefined,
                  })
                }
                className="w-full h-7 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                {selectedObject.type === 'highlight' ? 'Height (pt)' : 'Thickness'}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={
                  selectedObject.type === 'highlight'
                    ? Math.round(selectedObject.height)
                    : selectedObject.strokeWidth || 2
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (selectedObject.type === 'highlight') {
                    onUpdateObject({ height: val });
                  } else {
                    onUpdateObject({ strokeWidth: val });
                  }
                }}
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stamp specific properties */}
      {selectedObject.type === 'stamp' && (
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Stamp Text
            </label>
            <input
              type="text"
              value={
                selectedObject.stampText && selectedObject.stampText !== 'CUSTOM'
                  ? selectedObject.stampText
                  : selectedObject.stampType && selectedObject.stampType !== 'CUSTOM'
                  ? selectedObject.stampType
                  : 'APPROVED'
              }
              onChange={(e) =>
                onUpdateObject({
                  stampText: e.target.value.toUpperCase(),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold uppercase tracking-wider text-xs"
            />
          </div>
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
              Stamp Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={
                  selectedObject.strokeColor ||
                  selectedObject.textColor ||
                  (['REJECTED', 'CONFIDENTIAL'].includes(selectedObject.stampText || '')
                    ? '#dc2626'
                    : '#16a34a')
                }
                onChange={(e) =>
                  onUpdateObject({
                    strokeColor: e.target.value,
                    textColor: e.target.value,
                  })
                }
                className="w-9 h-8 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 font-mono">
                {selectedObject.strokeColor || selectedObject.textColor || '#16a34a'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Watermark specific properties */}
      {selectedObject.type === 'watermark' && (
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          {selectedObject.watermarkType === 'image' ? (
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300 block">
                Watermark Image
              </label>
              {selectedObject.imageDataUrl && (
                <img
                  src={selectedObject.imageDataUrl}
                  alt="Watermark preview"
                  className="w-20 h-20 object-contain rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={selectedObject.text || ''}
                  onChange={(e) => onUpdateObject({ text: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold uppercase tracking-wider text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Font Size ({selectedObject.fontSize || 54}pt)
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={96}
                    step={2}
                    value={selectedObject.fontSize || 54}
                    onChange={(e) => onUpdateObject({ fontSize: Number(e.target.value) })}
                    className="w-full accent-brand-600"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={selectedObject.textColor || '#dc2626'}
                    onChange={(e) => onUpdateObject({ textColor: e.target.value })}
                    className="w-full h-7 p-0.5 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Universal Opacity & Rotation */}
      <div className="flex flex-col gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div>
          <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
            Opacity: {Math.round((selectedObject.opacity ?? 1.0) * 100)}%
          </label>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={selectedObject.opacity ?? 1.0}
            onChange={(e) => onUpdateObject({ opacity: Number(e.target.value) })}
            className="w-full accent-brand-600"
          />
        </div>

        {/* Rotation Controls: Slider + Precision Numeric Input + Quick Buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-medium text-slate-700 dark:text-slate-300">
              Rotation ({Math.round(selectedObject.rotation || 0)}°)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={-360}
                max={360}
                value={Math.round(selectedObject.rotation || 0)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateObject({ rotation: ((val % 360) + 360) % 360 });
                }}
                className="w-14 px-1.5 py-0.5 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
              <span className="text-slate-500 text-xs">°</span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(((selectedObject.rotation || 0) % 360 + 360) % 360)}
            onChange={(e) => onUpdateObject({ rotation: Number(e.target.value) })}
            className="w-full accent-brand-600"
          />

          <div className="flex items-center justify-between gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                const current = selectedObject.rotation || 0;
                onUpdateObject({ rotation: ((current - 90) % 360 + 360) % 360 });
              }}
              className="flex-1 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 text-center transition-colors"
            >
              -90°
            </button>
            <button
              type="button"
              onClick={() => onUpdateObject({ rotation: 0 })}
              className="flex-1 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 text-center transition-colors"
            >
              Reset 0°
            </button>
            <button
              type="button"
              onClick={() => {
                const current = selectedObject.rotation || 0;
                onUpdateObject({ rotation: ((current + 90) % 360 + 360) % 360 });
              }}
              className="flex-1 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 text-center transition-colors flex items-center justify-center gap-0.5"
            >
              <RotateCw className="w-3 h-3" />
              <span>+90°</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
