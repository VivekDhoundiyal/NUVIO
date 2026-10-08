import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Sparkles, ScanText } from 'lucide-react';
import type { AnnotationObject, PageInfo, EditableTextSpan, TextWordItem, Point } from '../../types/document';
import type { EditorToolMode } from './EditorToolbar';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { TextObjectModel } from '../../engines/pdf/textObjectModel';
import { PdfCoordinateSystem } from '../../engines/pdf/pdfCoordinateSystem';
import { TransformableObject } from './TransformableObject';
import { Button } from '../../components/ui/Button';

export interface EditorCanvasProps {
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pages: PageInfo[];
  activePageIndex: number;
  zoom: number;
  toolMode: EditorToolMode;
  annotations: AnnotationObject[];
  selectedObjectId: string | null;
  selectedSpanId?: string | null;
  editableSpansByPage: Record<number, EditableTextSpan[]>;
  scannedPages: Record<number, boolean>;
  isFormatPainterActive?: boolean;
  onActivePageIndexChange: (index: number) => void;
  onSelectObject: (id: string | null) => void;
  onSelectSpan?: (id: string | null) => void;
  onApplyFormatPainter?: (span: EditableTextSpan) => void;
  onAddAnnotation: (annot: AnnotationObject) => void;
  onUpdateAnnotation: (id: string, updated: Partial<AnnotationObject>) => void;
  onDeleteAnnotation: (id: string) => void;
  onDeleteSpan?: (id: string) => void;
  onDuplicateAnnotation?: (id: string) => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onUpdateTextSpan: (span: EditableTextSpan) => void;
  onCommitTextEdit?: (span: EditableTextSpan) => Promise<void> | void;
  onRunOcrOnPage: (pageIndex: number) => void;
}

let measurementCanvas: HTMLCanvasElement | null = null;
let measurementCtx: CanvasRenderingContext2D | null = null;

export function measureTextWidth(text: string, fontSpec: string): number {
  if (typeof document === 'undefined') {
    return text.length * 8;
  }
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementCtx = measurementCanvas.getContext('2d');
  }
  if (!measurementCtx) {
    return text.length * 8;
  }
  try {
    measurementCtx.font = fontSpec;
    return measurementCtx.measureText(text).width;
  } catch {
    return text.length * 8;
  }
}

// Pure PDF.js vector canvas renderer - authoritative visual source of truth
interface PdfPageCanvasProps {
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  zoom: number;
  rotation: number;
}

const PdfPageCanvas = React.memo<PdfPageCanvasProps>(({
  pdfJsDoc,
  pageNumber,
  zoom,
  rotation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return;
    let isCancelled = false;

    PdfEngine.renderPageToCanvas(pdfJsDoc, pageNumber, canvasRef.current, zoom, rotation)
      .catch((err) => {
        if (!isCancelled && err?.name !== 'RenderingCancelledException' && !err?.message?.includes('cancelled')) {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfJsDoc, pageNumber, zoom, rotation]);

  return <canvas ref={canvasRef} className="block pointer-events-none" />;
});


export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  pdfJsDoc,
  pages,
  activePageIndex,
  zoom,
  toolMode,
  annotations,
  selectedObjectId,
  selectedSpanId,
  editableSpansByPage,
  scannedPages,
  isFormatPainterActive,
  onActivePageIndexChange,
  onSelectObject,
  onSelectSpan,
  onApplyFormatPainter,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onDeleteSpan,
  onDuplicateAnnotation,
  onBringForward,
  onSendBackward,
  onUpdateTextSpan,
  onCommitTextEdit,
  onRunOcrOnPage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Active inline text editing state (both span-level fallback and word-level precision)
  const [editingSpanId, setEditingSpanId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingWordValue, setEditingWordValue] = useState<string>('');
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const initialWordOnEditRef = useRef<string>('');

  // Freehand drawing state with RAF throttling to eliminate drawing lag
  const isDrawingRef = useRef(false);
  const drawingPageIndexRef = useRef<number | null>(null);
  const drawingPointsRef = useRef<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPageIndex, setDrawingPageIndex] = useState<number | null>(null);
  const [activeDrawingPoints, setActiveDrawingPoints] = useState<Point[]>([]);
  const drawingRafRef = useRef<number | null>(null);

  // Scroll listener to update active page index
  const handleScroll = useCallback(() => {
    if (!containerRef.current || pages.length === 0) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;

    let closestPage = 0;
    let minDistance = Infinity;

    pages.forEach((page) => {
      const el = document.getElementById(`nuvio-page-${page.pageIndex}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerTop - 40);
      if (distance < minDistance) {
        minDistance = distance;
        closestPage = page.pageIndex;
      }
    });

    if (closestPage !== activePageIndex) {
      onActivePageIndexChange(closestPage);
    }
  }, [pages, activePageIndex, onActivePageIndexChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          e.preventDefault();
          onDeleteAnnotation(selectedObjectId);
        } else if (selectedSpanId && onDeleteSpan) {
          e.preventDefault();
          onDeleteSpan(selectedSpanId);
        }
      } else if (e.key === 'Escape') {
        onSelectObject(null);
        onSelectSpan?.(null);
        setEditingSpanId(null);
        setEditingWordId(null);
        setEditingAnnotationId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, selectedSpanId, onDeleteAnnotation, onDeleteSpan, onSelectObject, onSelectSpan]);

  // Handle page click to insert objects (shapes, text, drawings, highlights, underlines, strikethroughs)
  const handlePageMouseDown = (e: React.MouseEvent, pageIndex: number) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName !== 'CANVAS') {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, (e.clientX - rect.left) / zoom);
    const y = Math.max(0, (e.clientY - rect.top) / zoom);

    if (toolMode === 'text') {
      const newText: AnnotationObject = {
        id: `text-${Date.now()}`,
        type: 'text',
        pageIndex,
        x,
        y,
        width: 160,
        height: 36,
        text: 'Type text here',
        fontSize: 14,
        fontFamily: 'Helvetica, sans-serif',
        textColor: '#0f172a',
        createdAt: Date.now(),
      };
      onAddAnnotation(newText);
      onSelectObject(newText.id);
    } else if (toolMode === 'highlight') {
      const newHighlight: AnnotationObject = {
        id: `hl-${Date.now()}`,
        type: 'highlight',
        shapeType: 'highlight',
        pageIndex,
        x,
        y,
        width: 140,
        height: 24,
        strokeColor: '#ffea00',
        fillColor: '#ffea00',
        opacity: 0.35,
        createdAt: Date.now(),
      };
      onAddAnnotation(newHighlight);
      onSelectObject(newHighlight.id);
    } else if (toolMode === 'underline') {
      const newUnderline: AnnotationObject = {
        id: `ul-${Date.now()}`,
        type: 'underline',
        shapeType: 'underline',
        pageIndex,
        x,
        y,
        width: 120,
        height: 4,
        strokeColor: '#2563eb',
        strokeWidth: 2,
        createdAt: Date.now(),
      };
      onAddAnnotation(newUnderline);
      onSelectObject(newUnderline.id);
    } else if (toolMode === 'strikethrough') {
      const newStrike: AnnotationObject = {
        id: `st-${Date.now()}`,
        type: 'strikethrough',
        shapeType: 'strikethrough',
        pageIndex,
        x,
        y,
        width: 120,
        height: 4,
        strokeColor: '#dc2626',
        strokeWidth: 2,
        createdAt: Date.now(),
      };
      onAddAnnotation(newStrike);
      onSelectObject(newStrike.id);
    } else if (toolMode === 'rectangle' || toolMode === 'circle') {
      const newShape: AnnotationObject = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        shapeType: toolMode,
        pageIndex,
        x,
        y,
        width: 120,
        height: 70,
        strokeColor: '#2563eb',
        strokeWidth: 2,
        fillColor: 'transparent',
        opacity: 1,
        createdAt: Date.now(),
      };
      onAddAnnotation(newShape);
      onSelectObject(newShape.id);
    } else if (toolMode === 'line' || toolMode === 'arrow') {
      const newLine: AnnotationObject = {
        id: `line-${Date.now()}`,
        type: 'shape',
        shapeType: toolMode,
        pageIndex,
        x,
        y,
        width: 120,
        height: 40,
        strokeColor: '#2563eb',
        strokeWidth: 2,
        createdAt: Date.now(),
      };
      onAddAnnotation(newLine);
      onSelectObject(newLine.id);
    } else if (toolMode === 'draw') {
      isDrawingRef.current = true;
      drawingPageIndexRef.current = pageIndex;
      drawingPointsRef.current = [{ x, y }];
      setIsDrawing(true);
      setDrawingPageIndex(pageIndex);
      setActiveDrawingPoints([{ x, y }]);
    } else if (toolMode === 'select') {
      onSelectObject(null);
      onSelectSpan?.(null);
      setEditingSpanId(null);
    }
  };

  const handlePageMouseMove = (e: React.MouseEvent, pageIndex: number) => {
    if (isDrawingRef.current && drawingPageIndexRef.current === pageIndex) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, (e.clientX - rect.left) / zoom);
      const y = Math.max(0, (e.clientY - rect.top) / zoom);
      drawingPointsRef.current.push({ x, y });

      if (drawingRafRef.current === null) {
        drawingRafRef.current = requestAnimationFrame(() => {
          setActiveDrawingPoints([...drawingPointsRef.current]);
          drawingRafRef.current = null;
        });
      }
    }
  };

  const handlePageMouseUp = (pageIndex: number, pageInfo: PageInfo) => {
    if (isDrawingRef.current && drawingPageIndexRef.current === pageIndex) {
      isDrawingRef.current = false;
      drawingPageIndexRef.current = null;
      setIsDrawing(false);
      setDrawingPageIndex(null);
      if (drawingRafRef.current !== null) {
        cancelAnimationFrame(drawingRafRef.current);
        drawingRafRef.current = null;
      }
      const points = [...drawingPointsRef.current];
      if (points.length > 1) {
        const newDrawing: AnnotationObject = {
          id: `draw-${Date.now()}`,
          type: 'drawing',
          pageIndex,
          x: 0,
          y: 0,
          width: pageInfo.width,
          height: pageInfo.height,
          points,
          strokeColor: '#0f172a',
          strokeWidth: 2.5,
          createdAt: Date.now(),
        };
        onAddAnnotation(newDrawing);
      }
      drawingPointsRef.current = [];
      setActiveDrawingPoints([]);
    }
  };

  // Text Span Editing Handlers - live keystroke commit
  const initialTextOnEditRef = useRef<string>('');

  const handleSpanClick = useCallback(
    (e: React.MouseEvent, span: EditableTextSpan) => {
      e.stopPropagation();

      // Direct one-click annotation when clicking text in annotation modes
      if (toolMode === 'highlight') {
        const newHl: AnnotationObject = {
          id: `hl-${Date.now()}`,
          type: 'highlight',
          shapeType: 'highlight',
          pageIndex: span.pageIndex,
          x: span.x,
          y: span.y,
          width: Math.max(20, span.width),
          height: Math.max(14, span.height),
          fillColor: '#ffea00',
          strokeColor: '#ffea00',
          opacity: 0.35,
          createdAt: Date.now(),
        };
        onAddAnnotation(newHl);
        onSelectObject(newHl.id);
        return;
      }

      if (toolMode === 'underline') {
        const newUl: AnnotationObject = {
          id: `ul-${Date.now()}`,
          type: 'underline',
          shapeType: 'underline',
          pageIndex: span.pageIndex,
          x: span.x,
          y: span.y + span.height - 2,
          width: Math.max(20, span.width),
          height: 4,
          strokeColor: '#2563eb',
          strokeWidth: 2,
          createdAt: Date.now(),
        };
        onAddAnnotation(newUl);
        onSelectObject(newUl.id);
        return;
      }

      if (toolMode === 'strikethrough') {
        const newSt: AnnotationObject = {
          id: `st-${Date.now()}`,
          type: 'strikethrough',
          shapeType: 'strikethrough',
          pageIndex: span.pageIndex,
          x: span.x,
          y: span.y + span.height / 2 - 2,
          width: Math.max(20, span.width),
          height: 4,
          strokeColor: '#dc2626',
          strokeWidth: 2,
          createdAt: Date.now(),
        };
        onAddAnnotation(newSt);
        onSelectObject(newSt.id);
        return;
      }

      // Check if format painter is active
      if (isFormatPainterActive && onApplyFormatPainter) {
        onApplyFormatPainter(span);
        return;
      }

      // Normal text editing mode
      onSelectObject(null);
      onSelectSpan?.(span.id);
      setEditingSpanId(span.id);
      setEditingTextValue(span.currentText);
      initialTextOnEditRef.current = span.currentText;
    },
    [toolMode, isFormatPainterActive, onApplyFormatPainter, onAddAnnotation, onSelectObject, onSelectSpan]
  );

  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setEditingTextValue(e.target.value);
  };

  const commitSpanEdit = (span: EditableTextSpan, pageHeight: number = 842) => {
    if (editingTextValue !== initialTextOnEditRef.current) {
      const syncedSpan = TextObjectModel.syncSpanText(span, editingTextValue, pageHeight);
      if (onCommitTextEdit) {
        onCommitTextEdit(syncedSpan);
      } else {
        onUpdateTextSpan(syncedSpan);
      }
    }
    setEditingSpanId(null);
  };

  const cancelSpanEdit = () => {
    setEditingTextValue(initialTextOnEditRef.current);
    setEditingSpanId(null);
  };

  // Word-Level Precision Editing Handlers
  const handleWordClick = useCallback(
    (e: React.MouseEvent, span: EditableTextSpan, word: TextWordItem) => {
      e.stopPropagation();

      if (toolMode === 'highlight') {
        const newHl: AnnotationObject = {
          id: `hl-${Date.now()}`,
          type: 'highlight',
          shapeType: 'highlight',
          pageIndex: word.pageIndex,
          x: word.x,
          y: word.y,
          width: Math.max(16, word.width),
          height: Math.max(14, word.height),
          fillColor: '#ffea00',
          strokeColor: '#ffea00',
          opacity: 0.35,
          createdAt: Date.now(),
        };
        onAddAnnotation(newHl);
        onSelectObject(newHl.id);
        return;
      }

      if (toolMode === 'underline') {
        const newUl: AnnotationObject = {
          id: `ul-${Date.now()}`,
          type: 'underline',
          shapeType: 'underline',
          pageIndex: word.pageIndex,
          x: word.x,
          y: word.y + word.height - 2,
          width: Math.max(16, word.width),
          height: 4,
          strokeColor: '#2563eb',
          strokeWidth: 2,
          createdAt: Date.now(),
        };
        onAddAnnotation(newUl);
        onSelectObject(newUl.id);
        return;
      }

      if (toolMode === 'strikethrough') {
        const newSt: AnnotationObject = {
          id: `st-${Date.now()}`,
          type: 'strikethrough',
          shapeType: 'strikethrough',
          pageIndex: word.pageIndex,
          x: word.x,
          y: word.y + word.height / 2 - 2,
          width: Math.max(16, word.width),
          height: 4,
          strokeColor: '#dc2626',
          strokeWidth: 2,
          createdAt: Date.now(),
        };
        onAddAnnotation(newSt);
        onSelectObject(newSt.id);
        return;
      }

      if (isFormatPainterActive && onApplyFormatPainter) {
        onApplyFormatPainter(span);
        return;
      }

      // In-place precision word editing
      onSelectObject(null);
      onSelectSpan?.(span.id);
      setEditingSpanId(span.id);
      setEditingWordId(word.id);
      setEditingWordValue(word.text);
      initialWordOnEditRef.current = word.text;
    },
    [toolMode, isFormatPainterActive, onApplyFormatPainter, onAddAnnotation, onSelectObject, onSelectSpan]
  );

  const handleWordChange = (nextVal: string) => {
    setEditingWordValue(nextVal);
  };

  const commitWordEdit = (span: EditableTextSpan, word: TextWordItem) => {
    if (editingWordValue !== initialWordOnEditRef.current) {
      const updatedSpan = TextObjectModel.updateWordInSpan(span, word.id, editingWordValue);
      if (onCommitTextEdit) {
        onCommitTextEdit(updatedSpan);
      } else {
        onUpdateTextSpan(updatedSpan);
      }
    }
    setEditingWordId(null);
    setEditingSpanId(null);
  };

  const cancelWordEdit = () => {
    setEditingWordValue(initialWordOnEditRef.current);
    setEditingWordId(null);
    setEditingSpanId(null);
  };

  if (!pages || pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
        No document pages loaded
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-6 flex flex-col items-center gap-8 min-h-0 select-none"
    >
      {pages.map((page) => {
        const visualWidth = page.width * zoom;
        const visualHeight = page.height * zoom;
        const pageSpans = editableSpansByPage[page.pageIndex] || [];
        const pageAnnotations = annotations.filter((a) => a.pageIndex === page.pageIndex);
        const isScanned = scannedPages[page.pageIndex];

        return (
          <div
            key={page.pageIndex}
            id={`nuvio-page-${page.pageIndex}`}
            className="flex flex-col items-center"
          >
            {/* Top Page Label & Scanned Notice */}
            <div className="flex items-center justify-between w-full max-w-full mb-2 px-1 text-xs text-slate-500">
              <span className="font-medium bg-white/80 dark:bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-2xs">
                Page {page.pageIndex + 1} of {pages.length} • {Math.round(page.width)} × {Math.round(page.height)} pt
              </span>
            </div>

            {/* Scanned page detection banner */}
            {isScanned && (
              <div className="w-full mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <ScanText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Scanned Page:</strong> No native digital text detected. Run OCR to make text editable.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRunOcrOnPage(page.pageIndex)}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-500" />}
                >
                  Run OCR on Page
                </Button>
              </div>
            )}

            {/* Page Viewport Box */}
            <div
              className="relative bg-white shadow-elevated border border-slate-300 dark:border-slate-800 transition-shadow"
              style={{
                width: visualWidth,
                height: visualHeight,
                cursor:
                  toolMode === 'draw'
                    ? 'crosshair'
                    : toolMode === 'text'
                    ? 'text'
                    : toolMode === 'highlight' || toolMode === 'underline' || toolMode === 'strikethrough'
                    ? 'cell'
                    : toolMode === 'select'
                    ? 'default'
                    : 'crosshair',
              }}
              onMouseDown={(e) => handlePageMouseDown(e, page.pageIndex)}
              onMouseMove={(e) => handlePageMouseMove(e, page.pageIndex)}
              onMouseUp={() => handlePageMouseUp(page.pageIndex, page)}
            >
              {/* PDF Background Canvas (Pure PDF.js Vector Rendering) */}
              <PdfPageCanvas
                pdfJsDoc={pdfJsDoc}
                pageNumber={page.pageIndex + 1}
                zoom={zoom}
                rotation={page.rotation || 0}
              />

              {/* Freehand Drawing SVG Preview (Throttled with RAF) */}
              {isDrawing && drawingPageIndex === page.pageIndex && activeDrawingPoints.length > 1 && (
                <svg className="absolute inset-0 pointer-events-none w-full h-full z-30">
                  <polyline
                    points={activeDrawingPoints.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={2.5 * zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {/* INTERACTIVE TEXT SPANS & PRECISION WORD LAYER (Real PDF Text Editing & Formatting Preservation) */}
              <div className="absolute inset-0 pointer-events-none">
                {pageSpans.map((span) => {
                  let spanLeft = span.x * zoom;
                  let spanTop = span.y * zoom;
                  let spanWidth = Math.max(span.width * zoom, 20);
                  let spanHeight = Math.max(span.height * zoom, span.fontSize * zoom);

                  if (page.rotation && page.rotation % 360 !== 0 && span.pdfX !== undefined && span.pdfY !== undefined) {
                    const rect = PdfCoordinateSystem.pdfToViewport(
                      span.pdfX,
                      span.pdfY,
                      span.width,
                      span.height || span.fontSize,
                      { width: page.width, height: page.height, rotation: page.rotation },
                      zoom
                    );
                    spanLeft = rect.x;
                    spanTop = rect.y;
                    spanWidth = Math.max(rect.width, 20);
                    spanHeight = Math.max(rect.height, span.fontSize * zoom);
                  }

                  // If span was deleted, render clean localized mask obscuring the original text on the PDF canvas
                  if (span.isDeleted) {
                    const isSelected = selectedSpanId === span.id;
                    return (
                      <div
                        key={span.id}
                        onClick={(e) => handleSpanClick(e, span)}
                        title={`Deleted text: "${span.originalText}" (Click to select/restore)`}
                        className={`absolute pointer-events-auto z-20 rounded-xs transition-shadow ${
                          isSelected ? 'ring-2 ring-red-500 shadow-xs' : 'hover:ring-1 hover:ring-red-400'
                        }`}
                        style={{
                          left: spanLeft,
                          top: spanTop,
                          width: spanWidth,
                          height: spanHeight,
                          backgroundColor: span.backgroundColor || '#ffffff',
                        }}
                      />
                    );
                  }

                  // 2. Actively editing entire span
                  const isEditingSpan = editingSpanId === span.id && !editingWordId;
                  if (isEditingSpan) {
                    const lines = (editingTextValue || '').split('\n');
                    const isMultiLine = lines.length > 1;

                    const fontSpec = `${span.fontStyle === 'italic' ? 'italic ' : ''}${span.fontWeight === 'bold' ? 'bold ' : ''}${Math.round((span.fontSize || 12) * zoom)}px ${span.fontFamily || 'Helvetica, Arial, sans-serif'}`;

                    if (!isMultiLine) {
                      const measuredWidth = measureTextWidth(editingTextValue || '', fontSpec);
                      const dynamicInputWidth = Math.max(spanWidth + 16, Math.ceil(measuredWidth + 28));
                      return (
                        <div
                          key={span.id}
                          className="absolute pointer-events-auto z-40 bg-white ring-2 ring-brand-500 shadow-md rounded-xs flex items-center px-1.5"
                          style={{
                            left: spanLeft - 1,
                            top: spanTop - 1,
                            minWidth: Math.max(spanWidth + 12, 32),
                            width: `${dynamicInputWidth}px`,
                            height: Math.max(spanHeight + 4, 20),
                            boxSizing: 'border-box',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            type="text"
                            value={editingTextValue}
                            onChange={handleTextChange}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitSpanEdit(span, page.height);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelSpanEdit();
                              }
                            }}
                            onBlur={() => commitSpanEdit(span, page.height)}
                            style={{
                              fontSize: `${(span.verticalAlign === 'super' || span.verticalAlign === 'sub' ? Math.max(6, Math.round(span.fontSize * 0.7)) : Math.round(span.fontSize || 12)) * zoom}px`,
                              color: span.color,
                              fontFamily: span.fontFamily || 'Helvetica, Arial, sans-serif',
                              fontWeight: span.fontWeight,
                              fontStyle: span.fontStyle,
                              textAlign: span.textAlign || 'left',
                              letterSpacing: span.letterSpacing ? `${span.letterSpacing * zoom}px` : undefined,
                              boxSizing: 'border-box',
                            }}
                            className="w-full h-full bg-transparent outline-none border-none p-0 leading-none"
                          />
                        </div>
                      );
                    }

                    const lineCount = lines.length;
                    const effectiveLineHeight = (span.lineHeight || 1.25) * (span.fontSize || 12) * zoom;
                    const editorHeight = Math.max(spanHeight, lineCount * effectiveLineHeight);
                    const maxLineWidth = Math.max(...lines.map((l) => measureTextWidth(l, fontSpec)));
                    const dynamicAreaWidth = Math.max(spanWidth + 24, Math.ceil(maxLineWidth + 32));

                    return (
                      <div
                        key={span.id}
                        className="absolute pointer-events-auto z-40 bg-white ring-2 ring-brand-500 shadow-md rounded-xs p-1"
                        style={{
                          left: spanLeft,
                          top: spanTop,
                          minWidth: Math.max(spanWidth + 16, 40),
                          width: `${dynamicAreaWidth}px`,
                          height: editorHeight + 6,
                          boxSizing: 'border-box',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          autoFocus
                          rows={lineCount}
                          value={editingTextValue}
                          onChange={handleTextChange}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              commitSpanEdit(span, page.height);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelSpanEdit();
                            }
                          }}
                          onBlur={() => commitSpanEdit(span, page.height)}
                          style={{
                            fontSize: `${(span.verticalAlign === 'super' || span.verticalAlign === 'sub' ? Math.max(6, Math.round(span.fontSize * 0.7)) : Math.round(span.fontSize || 12)) * zoom}px`,
                            color: span.color,
                            fontFamily: span.fontFamily || 'Helvetica, Arial, sans-serif',
                            fontWeight: span.fontWeight,
                            fontStyle: span.fontStyle,
                            textAlign: span.textAlign || 'left',
                            letterSpacing: span.letterSpacing ? `${span.letterSpacing * zoom}px` : undefined,
                            verticalAlign: span.verticalAlign || 'baseline',
                            lineHeight: `${effectiveLineHeight}px`,
                            textDecoration: span.strikethrough
                              ? span.underline
                                ? 'underline line-through'
                                : 'line-through'
                              : span.underline
                              ? 'underline'
                              : undefined,
                            resize: 'none',
                            boxSizing: 'border-box',
                          }}
                          className="w-full h-full p-0.5 bg-transparent outline-none border-none leading-normal"
                        />
                      </div>
                    );
                  }

                  // 3. Actively editing a specific word in this span
                  const isEditingWordInThisSpan = Boolean(editingWordId && span.words && span.words.some((w) => w.id === editingWordId));
                  if (isEditingWordInThisSpan && span.words) {
                    return span.words.map((word) => {
                      const isEditingWord = editingWordId === word.id;
                      let wordLeft = word.x * zoom;
                      let wordTop = word.y * zoom;
                      let wordWidth = Math.max(word.width * zoom, 10);
                      let wordHeight = Math.max(word.height * zoom, word.fontSize * zoom);

                      if (page.rotation && page.rotation % 360 !== 0 && word.pdfX !== undefined && word.pdfY !== undefined) {
                        const rect = PdfCoordinateSystem.pdfToViewport(
                          word.pdfX,
                          word.pdfY,
                          word.width,
                          word.height || word.fontSize,
                          { width: page.width, height: page.height, rotation: page.rotation },
                          zoom
                        );
                        wordLeft = rect.x;
                        wordTop = rect.y;
                        wordWidth = Math.max(rect.width, 10);
                        wordHeight = Math.max(rect.height, word.fontSize * zoom);
                      }

                      if (isEditingWord) {
                        const fontSpec = `${word.fontStyle === 'italic' ? 'italic ' : ''}${word.fontWeight === 'bold' ? 'bold ' : ''}${Math.round((word.fontSize || 12) * zoom)}px ${word.fontFamily || 'Helvetica, Arial, sans-serif'}`;
                        const measuredWidth = measureTextWidth(editingWordValue || '', fontSpec);
                        const dynamicInputWidth = Math.max(wordWidth + 16, Math.ceil(measuredWidth + 28));
                        return (
                          <div
                            key={word.id}
                            className="absolute pointer-events-auto z-40 bg-white ring-2 ring-brand-500 shadow-md rounded-xs flex items-center px-1.5"
                            style={{
                              left: wordLeft - 1,
                              top: wordTop - 1,
                              minWidth: Math.max(wordWidth + 12, 32),
                              width: `${dynamicInputWidth}px`,
                              height: Math.max(wordHeight + 4, 20),
                              boxSizing: 'border-box',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              type="text"
                              value={editingWordValue}
                              onChange={(e) => handleWordChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitWordEdit(span, word);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelWordEdit();
                                }
                              }}
                              onBlur={() => commitWordEdit(span, word)}
                              style={{
                                fontSize: `${Math.round((word.fontSize || 12) * zoom)}px`,
                                color: word.color || '#000000',
                                fontFamily: word.fontFamily || 'Helvetica, Arial, sans-serif',
                                fontWeight: word.fontWeight || 'normal',
                                fontStyle: word.fontStyle || 'normal',
                                boxSizing: 'border-box',
                              }}
                              className="w-full h-full bg-transparent outline-none border-none p-0 leading-none"
                            />
                          </div>
                        );
                      }

                      // Untouched word: transparent hit area
                      return (
                        <div
                          key={word.id}
                          onClick={(e) => handleWordClick(e, span, word)}
                          onDoubleClick={(e) => handleSpanClick(e, span)}
                          title={
                            isFormatPainterActive
                              ? `Apply formatting to "${word.originalText}"`
                              : toolMode === 'highlight'
                              ? `Highlight "${word.originalText}"`
                              : toolMode === 'underline'
                              ? `Underline "${word.originalText}"`
                              : toolMode === 'strikethrough'
                              ? `Strikethrough "${word.originalText}"`
                              : `Click to edit: "${word.originalText}"`
                          }
                          className={`absolute pointer-events-auto cursor-text rounded-xs transition-colors ${
                            selectedSpanId === span.id
                              ? 'ring-1 ring-brand-500/70 bg-brand-500/10'
                              : isFormatPainterActive
                              ? 'hover:bg-brand-500/25 hover:ring-2 hover:ring-brand-500 cursor-crosshair'
                              : toolMode === 'highlight'
                              ? 'hover:bg-yellow-400/30 hover:ring-1 hover:ring-yellow-500'
                              : toolMode === 'underline'
                              ? 'hover:bg-blue-400/20 hover:border-b-2 hover:border-blue-600'
                              : toolMode === 'strikethrough'
                              ? 'hover:bg-red-400/20 hover:ring-1 hover:ring-red-500'
                              : 'hover:bg-brand-500/10 hover:ring-1 hover:ring-brand-400/50'
                          }`}
                          style={{
                            left: wordLeft,
                            top: wordTop,
                            width: wordWidth,
                            height: wordHeight,
                          }}
                        />
                      );
                    });
                  }

                  // 5. Untouched span: word-level micro-hit targets (transparent hit boxes so original PDF canvas shines through 100%)
                  if (span.words && span.words.length > 0) {
                    return span.words.map((word) => {
                      let wordLeft = word.x * zoom;
                      let wordTop = word.y * zoom;
                      let wordWidth = Math.max(word.width * zoom, 10);
                      let wordHeight = Math.max(word.height * zoom, word.fontSize * zoom);

                      if (page.rotation && page.rotation % 360 !== 0 && word.pdfX !== undefined && word.pdfY !== undefined) {
                        const rect = PdfCoordinateSystem.pdfToViewport(
                          word.pdfX,
                          word.pdfY,
                          word.width,
                          word.height || word.fontSize,
                          { width: page.width, height: page.height, rotation: page.rotation },
                          zoom
                        );
                        wordLeft = rect.x;
                        wordTop = rect.y;
                        wordWidth = Math.max(rect.width, 10);
                        wordHeight = Math.max(rect.height, word.fontSize * zoom);
                      }

                      return (
                        <div
                          key={word.id}
                          onClick={(e) => handleWordClick(e, span, word)}
                          onDoubleClick={(e) => handleSpanClick(e, span)}
                          title={
                            isFormatPainterActive
                              ? `Apply formatting to "${word.originalText}"`
                              : toolMode === 'highlight'
                              ? `Highlight "${word.originalText}"`
                              : toolMode === 'underline'
                              ? `Underline "${word.originalText}"`
                              : toolMode === 'strikethrough'
                              ? `Strikethrough "${word.originalText}"`
                              : `Click to edit: "${word.originalText}"`
                          }
                          className={`absolute pointer-events-auto cursor-text rounded-xs transition-colors ${
                            selectedSpanId === span.id
                              ? 'ring-1 ring-brand-500/70 bg-brand-500/10'
                              : isFormatPainterActive
                              ? 'hover:bg-brand-500/25 hover:ring-2 hover:ring-brand-500 cursor-crosshair'
                              : toolMode === 'highlight'
                              ? 'hover:bg-yellow-400/30 hover:ring-1 hover:ring-yellow-500'
                              : toolMode === 'underline'
                              ? 'hover:bg-blue-400/20 hover:border-b-2 hover:border-blue-600'
                              : toolMode === 'strikethrough'
                              ? 'hover:bg-red-400/20 hover:ring-1 hover:ring-red-500'
                              : 'hover:bg-brand-500/10 hover:ring-1 hover:ring-brand-400/50'
                          }`}
                          style={{
                            left: wordLeft,
                            top: wordTop,
                            width: wordWidth,
                            height: wordHeight,
                          }}
                        />
                      );
                    });
                  }

                  // 6. Untouched fallback: span without tokenized words
                  const isSelected = selectedSpanId === span.id;
                  return (
                    <div
                      key={span.id}
                      onClick={(e) => handleSpanClick(e, span)}
                      title={
                        isFormatPainterActive
                          ? `Apply formatting to "${span.originalText}"`
                          : toolMode === 'highlight'
                          ? `Highlight "${span.originalText}"`
                          : toolMode === 'underline'
                          ? `Underline "${span.originalText}"`
                          : toolMode === 'strikethrough'
                          ? `Strikethrough "${span.originalText}"`
                          : `Click to edit text: "${span.originalText}"`
                      }
                      className={`absolute pointer-events-auto cursor-text rounded-xs transition-colors ${
                        isSelected
                          ? 'ring-2 ring-brand-500 bg-brand-500/20'
                          : isFormatPainterActive
                          ? 'hover:bg-brand-500/25 hover:ring-2 hover:ring-brand-500 cursor-crosshair'
                          : toolMode === 'highlight'
                          ? 'hover:bg-yellow-400/30 hover:ring-1 hover:ring-yellow-500'
                          : toolMode === 'underline'
                          ? 'hover:bg-blue-400/20 hover:border-b-2 hover:border-blue-600'
                          : toolMode === 'strikethrough'
                          ? 'hover:bg-red-400/20 hover:ring-1 hover:ring-red-500'
                          : 'hover:bg-brand-500/10 hover:ring-1 hover:ring-brand-400/50'
                      }`}
                      style={{
                        left: spanLeft,
                        top: spanTop,
                        width: spanWidth,
                        height: spanHeight,
                      }}
                    />
                  );
                })}
              </div>

              {/* INTERACTIVE OBJECTS LAYER (Signatures, Shapes, Drawings, Stamps, Images, Highlights, Underlines, Strikethroughs) */}
              {pageAnnotations.map((obj) => (
                <TransformableObject
                  key={obj.id}
                  obj={obj}
                  zoom={zoom}
                  pageWidth={page.width}
                  pageHeight={page.height}
                  isSelected={selectedObjectId === obj.id}
                  onSelect={() => {
                    onSelectSpan?.(null);
                    onSelectObject(obj.id);
                  }}
                  onUpdate={(updated) => onUpdateAnnotation(obj.id, updated)}
                  onDelete={() => onDeleteAnnotation(obj.id)}
                  onDuplicate={
                    onDuplicateAnnotation ? () => onDuplicateAnnotation(obj.id) : undefined
                  }
                  onBringForward={onBringForward}
                  onSendBackward={onSendBackward}
                  onDragPageHandoff={(newPageIndex, newX, newY) => {
                    onUpdateAnnotation(obj.id, { pageIndex: newPageIndex, x: newX, y: newY });
                    onActivePageIndexChange(newPageIndex);
                  }}
                >
                  {/* Signature or Image Object */}
                  {(obj.type === 'signature' || obj.type === 'image') && obj.imageDataUrl && (
                    <img
                      src={obj.imageDataUrl}
                      alt={obj.type}
                      className="w-full h-full object-contain pointer-events-none select-none"
                      style={{ opacity: obj.opacity !== undefined ? obj.opacity : 1 }}
                      draggable={false}
                    />
                  )}

                  {/* Stamp Object */}
                  {obj.type === 'stamp' && (() => {
                    const text =
                      obj.stampText && obj.stampText !== 'CUSTOM'
                        ? obj.stampText
                        : obj.stampType && obj.stampType !== 'CUSTOM'
                        ? obj.stampType
                        : 'APPROVED';
                    const stampColor =
                      obj.strokeColor ||
                      obj.textColor ||
                      (['REJECTED', 'CONFIDENTIAL'].includes(text) ? '#dc2626' : '#16a34a');

                    return (
                      <div
                        className="w-full h-full border-2 rounded-sm flex items-center justify-center font-bold uppercase tracking-wider text-center p-1 select-none"
                        style={{
                          borderColor: stampColor,
                          color: stampColor,
                          backgroundColor: `${stampColor}14`,
                          fontSize: `${Math.min(obj.height * zoom * 0.45, 20)}px`,
                          opacity: obj.opacity !== undefined ? obj.opacity : 1,
                        }}
                      >
                        {text}
                      </div>
                    );
                  })()}

                  {/* Inserted Text Object */}
                  {obj.type === 'text' && (
                    editingAnnotationId === obj.id ? (
                      <textarea
                        autoFocus
                        value={obj.text || ''}
                        onChange={(e) => onUpdateAnnotation(obj.id, { text: e.target.value })}
                        onBlur={() => setEditingAnnotationId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingAnnotationId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: `${(obj.verticalAlign === 'super' || obj.verticalAlign === 'sub' ? Math.max(6, (obj.fontSize || 14) * 0.7) : (obj.fontSize || 14)) * zoom}px`,
                          color: obj.textColor || '#0f172a',
                          fontFamily: obj.fontFamily || 'Helvetica, sans-serif',
                          fontWeight: obj.fontWeight || 'normal',
                          fontStyle: obj.fontStyle || 'normal',
                          textAlign: obj.textAlign || 'left',
                          lineHeight: 1.25,
                          backgroundColor: obj.backgroundColor && obj.backgroundColor !== 'transparent' ? obj.backgroundColor : '#ffffff',
                          resize: 'none',
                        }}
                        className="w-full h-full p-1 outline-none border border-brand-500 rounded-xs ring-1 ring-brand-500"
                      />
                    ) : (
                      <div
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingAnnotationId(obj.id);
                        }}
                        className="w-full h-full flex items-center px-1 overflow-visible break-words whitespace-pre-wrap select-none cursor-text"
                        style={{
                          fontSize: `${(obj.verticalAlign === 'super' || obj.verticalAlign === 'sub' ? Math.max(6, (obj.fontSize || 14) * 0.7) : (obj.fontSize || 14)) * zoom}px`,
                          color: obj.textColor || '#0f172a',
                          fontFamily: obj.fontFamily || 'Helvetica, sans-serif',
                          fontWeight: obj.fontWeight || 'normal',
                          fontStyle: obj.fontStyle || 'normal',
                          textAlign: obj.textAlign || 'left',
                          verticalAlign: obj.verticalAlign || 'baseline',
                          letterSpacing: obj.letterSpacing ? `${obj.letterSpacing * zoom}px` : undefined,
                          textDecoration: obj.strikethrough
                            ? obj.underline
                              ? 'underline line-through'
                              : 'line-through'
                            : obj.underline
                            ? 'underline'
                            : undefined,
                          backgroundColor: obj.backgroundColor || 'transparent',
                          opacity: obj.opacity !== undefined ? obj.opacity : 1,
                        }}
                      >
                        {obj.text || ''}
                      </div>
                    )
                  )}

                  {/* Watermark Object (Text or Image) */}
                  {obj.type === 'watermark' && (
                    <div className="w-full h-full pointer-events-none flex items-center justify-center overflow-hidden">
                      {obj.watermarkType === 'image' && obj.imageDataUrl ? (
                        <img
                          src={obj.imageDataUrl}
                          alt="Watermark"
                          className="w-full h-full object-contain select-none"
                          style={{ opacity: obj.opacity !== undefined ? obj.opacity : 0.25 }}
                          draggable={false}
                        />
                      ) : (
                        <span
                          className="font-bold uppercase tracking-wider text-center select-none"
                          style={{
                            fontSize: `${(obj.fontSize || 54) * zoom}px`,
                            color: obj.textColor || '#dc2626',
                            opacity: obj.opacity !== undefined ? obj.opacity : 0.25,
                            lineHeight: 1.1,
                          }}
                        >
                          {obj.text || ''}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Dedicated Highlight Object */}
                  {(obj.type === 'highlight' || obj.shapeType === 'highlight') && (
                    <div
                      className="w-full h-full pointer-events-none rounded-xs"
                      style={{
                        backgroundColor: obj.fillColor || obj.strokeColor || '#ffea00',
                        opacity: obj.opacity !== undefined ? obj.opacity : 0.35,
                      }}
                    />
                  )}

                  {/* Dedicated Underline Object */}
                  {(obj.type === 'underline' || obj.shapeType === 'underline') && (
                    <div className="w-full h-full flex items-center pointer-events-none">
                      <div
                        className="w-full"
                        style={{
                          height: `${(obj.strokeWidth || 2) * zoom}px`,
                          backgroundColor: obj.strokeColor || '#2563eb',
                        }}
                      />
                    </div>
                  )}

                  {/* Dedicated Strikethrough Object */}
                  {(obj.type === 'strikethrough' || obj.shapeType === 'strikethrough') && (
                    <div className="w-full h-full flex items-center pointer-events-none">
                      <div
                        className="w-full"
                        style={{
                          height: `${(obj.strokeWidth || 2) * zoom}px`,
                          backgroundColor: obj.strokeColor || '#dc2626',
                        }}
                      />
                    </div>
                  )}

                  {/* Shape Objects (Rectangle, Circle, Line, Arrow) */}
                  {obj.type === 'shape' && obj.shapeType !== 'highlight' && obj.shapeType !== 'underline' && obj.shapeType !== 'strikethrough' && (
                    <svg className="w-full h-full overflow-visible pointer-events-none">
                      {obj.shapeType === 'rectangle' && (
                        <rect
                          x="0"
                          y="0"
                          width="100%"
                          height="100%"
                          fill={obj.fillColor || 'transparent'}
                          stroke={obj.strokeColor || '#2563eb'}
                          strokeWidth={(obj.strokeWidth || 2) * zoom}
                          opacity={obj.opacity !== undefined ? obj.opacity : 1}
                        />
                      )}
                      {obj.shapeType === 'circle' && (
                        <ellipse
                          cx="50%"
                          cy="50%"
                          rx="50%"
                          ry="50%"
                          fill={obj.fillColor || 'transparent'}
                          stroke={obj.strokeColor || '#2563eb'}
                          strokeWidth={(obj.strokeWidth || 2) * zoom}
                          opacity={obj.opacity !== undefined ? obj.opacity : 1}
                        />
                      )}
                      {(obj.shapeType === 'line' || obj.shapeType === 'arrow') && (
                        <line
                          x1="0"
                          y1="0"
                          x2="100%"
                          y2="100%"
                          stroke={obj.strokeColor || '#2563eb'}
                          strokeWidth={(obj.strokeWidth || 2) * zoom}
                          opacity={obj.opacity !== undefined ? obj.opacity : 1}
                        />
                      )}
                    </svg>
                  )}

                  {/* Freehand Drawing Object */}
                  {obj.type === 'drawing' && obj.points && obj.points.length > 1 && (
                    <svg className="w-full h-full pointer-events-none">
                      <polyline
                        points={obj.points
                          .map((p) => `${(p.x - obj.x) * zoom},${(p.y - obj.y) * zoom}`)
                          .join(' ')}
                        fill="none"
                        stroke={obj.strokeColor || '#0f172a'}
                        strokeWidth={(obj.strokeWidth || 2.5) * zoom}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={obj.opacity !== undefined ? obj.opacity : 1}
                      />
                    </svg>
                  )}
                </TransformableObject>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
