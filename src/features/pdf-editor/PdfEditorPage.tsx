import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { saveAs } from 'file-saver';
import { ArrowLeft, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { PageInfo, AnnotationObject, ValidationReport, EditableTextSpan } from '../../types/document';
import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { AnnotationBurner } from '../../engines/annotation/annotationBurner';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { TextObjectModel } from '../../engines/pdf/textObjectModel';
import { OcrEngine } from '../../engines/ocr/ocrEngine';
import { StorageService } from '../../services/storage/db';
import { FileSessionStore } from '../../services/storage/fileSessionStore';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { ValidationModal } from '../../components/validation/ValidationModal';
import { ValidationBadge } from '../../components/validation/ValidationBadge';

import { EditorToolbar } from './EditorToolbar';
import type { EditorToolMode, TextStyleProps } from './EditorToolbar';
import { EditorThumbnails } from './EditorThumbnails';
import { EditorCanvas } from './EditorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { SignatureModal } from './SignatureModal';
import { StampModal } from './StampModal';
import { WatermarkModal } from './WatermarkModal';
import type { WatermarkOptions } from './WatermarkModal';
import { toggleListFormatting } from '../../utils/pdfSanitize';

interface HistoryState {
  annotations: AnnotationObject[];
  editableSpansByPage: Record<number, EditableTextSpan[]>;
  pages: PageInfo[];
}

export const PdfEditorPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pdfJsDoc, setPdfJsDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [toolMode, setToolMode] = useState<EditorToolMode>('select');
  const [zoom, setZoom] = useState<number>(1.0);
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Format Painter state
  const [copiedStyle, setCopiedStyle] = useState<Partial<EditableTextSpan> | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState<boolean>(false);

  // Clipboard state for copy/paste
  const [copiedObject, setCopiedObject] = useState<AnnotationObject | null>(null);

  // Autosave Status: saved | saving | unsaved | error
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable text spans and scanned page detection
  const [editableSpansByPage, setEditableSpansByPage] = useState<Record<number, EditableTextSpan[]>>({});
  const [scannedPages, setScannedPages] = useState<Record<number, boolean>>({});

  // Undo / Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  // Export & Validation
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [latestReport, setLatestReport] = useState<ValidationReport | undefined>(undefined);

  // Incremental, debounced autosave across all mutations
  const triggerAutosave = useCallback(
    (
      currentAnnotations: AnnotationObject[],
      currentSpans: Record<number, EditableTextSpan[]>,
      currentPages: PageInfo[]
    ) => {
      setAutosaveStatus('saving');
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          if (!fileName) return;
          await StorageService.saveDraft({
            id: `draft-${fileName}`,
            title: fileName,
            fileName,
            annotations: currentAnnotations,
            editableSpansByPage: currentSpans,
            pages: currentPages,
            pageRotations: {},
            deletedPages: [],
            lastModified: Date.now(),
          });
          setAutosaveStatus('saved');
        } catch (err) {
          console.error('Autosave error:', err);
          setAutosaveStatus('error');
        }
      }, 600);
    },
    [fileName]
  );

  // Push to history
  const recordHistory = useCallback(
    (
      newAnnotations: AnnotationObject[],
      newSpansByPage: Record<number, EditableTextSpan[]>,
      newPages: PageInfo[]
    ) => {
      const newState: HistoryState = {
        annotations: JSON.parse(JSON.stringify(newAnnotations)),
        editableSpansByPage: JSON.parse(JSON.stringify(newSpansByPage)),
        pages: JSON.parse(JSON.stringify(newPages)),
      };
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), newState]);
      setHistoryIndex((prev) => prev + 1);
      triggerAutosave(newAnnotations, newSpansByPage, newPages);
    },
    [historyIndex, triggerAutosave]
  );

  // Load PDF file
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

      // Generate thumbnails for pages
      const pagesWithThumbnails: PageInfo[] = [];
      const spansByPage: Record<number, EditableTextSpan[]> = {};
      const scannedMap: Record<number, boolean> = {};

      for (const p of info.pages) {
        const thumb = await PdfEngine.generateThumbnail(docProxy, p.pageIndex + 1, 140);
        pagesWithThumbnails.push({ ...p, thumbnailUrl: thumb });

        // Extract text spans & check if scanned
        const { textSpans, isScanned } = await PdfEngine.extractPageTextSpans(docProxy, p.pageIndex + 1);
        spansByPage[p.pageIndex] = textSpans;
        scannedMap[p.pageIndex] = isScanned;
      }

      setPdfJsDoc(docProxy);
      setPages(pagesWithThumbnails);
      setActivePageIndex(0);
      setAnnotations([]);
      setSelectedObjectId(null);
      setEditableSpansByPage(spansByPage);
      setScannedPages(scannedMap);

      // Initialize history
      setHistory([
        {
          annotations: [],
          editableSpansByPage: spansByPage,
          pages: pagesWithThumbnails,
        },
      ]);
      setHistoryIndex(0);

      await StorageService.logToolUsage('pdf-editor');
      await StorageService.logRecentFile({
        fileName: file.name,
        fileSizeBytes: file.size,
        pageCount: info.pages.length,
      });

      toast.success('Document loaded', `${file.name} (${info.pages.length} pages ready for editing)`);
    } catch (e: any) {
      toast.error('Failed to load PDF', e.message || 'Please check that the file is not encrypted or corrupted.');
    }
  }, [toast]);

  const hasLoadedSessionRef = useRef(false);

  // Auto-load active file from homepage or previous action if present
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

  // Change file / Reset
  const handleChangeFile = () => {
    FileSessionStore.clear();
    setPdfBytes(null);
    setPdfJsDoc(null);
    setPages([]);
    setActivePageIndex(0);
    setAnnotations([]);
    setSelectedObjectId(null);
    setSelectedSpanId(null);
    setCopiedStyle(null);
    setIsFormatPainterActive(false);
    setEditableSpansByPage({});
    setScannedPages({});
    setHistory([]);
    setHistoryIndex(-1);
    setLatestReport(undefined);
  };

  // Page Operations
  const handleRotatePage = (index: number) => {
    const nextPages = pages.map((p, i) => {
      if (i === index) {
        const newRot = ((p.rotation || 0) + 90) % 360;
        return { ...p, rotation: newRot };
      }
      return p;
    });
    setPages(nextPages);
    recordHistory(annotations, editableSpansByPage, nextPages);
    toast.info(`Rotated page ${index + 1}`, '+90 degrees');
  };

  const handleDuplicatePage = (index: number) => {
    const pageToDup = pages[index];
    const newPages = [...pages];
    const duplicatedPage: PageInfo = {
      ...pageToDup,
      pageIndex: pages.length,
    };
    newPages.splice(index + 1, 0, duplicatedPage);
    setPages(newPages);

    // Duplicate text spans and annotations for this page
    const existingSpans = editableSpansByPage[pageToDup.pageIndex] || [];
    const duplicatedSpans: EditableTextSpan[] = existingSpans.map((s, sIdx) => ({
      ...s,
      id: `span-dup-${duplicatedPage.pageIndex}-${sIdx}-${Date.now()}`,
      pageIndex: duplicatedPage.pageIndex,
    }));

    const nextSpansByPage = {
      ...editableSpansByPage,
      [duplicatedPage.pageIndex]: duplicatedSpans,
    };
    setEditableSpansByPage(nextSpansByPage);

    recordHistory(annotations, nextSpansByPage, newPages);
    toast.success('Page duplicated', `Created copy of page ${index + 1}`);
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      toast.warning('Cannot delete', 'Document must contain at least one page.');
      return;
    }
    const nextPages = pages.filter((_, i) => i !== index);
    const nextAnnotations = annotations.filter((a) => a.pageIndex !== index);
    setPages(nextPages);
    setAnnotations(nextAnnotations);

    if (activePageIndex >= nextPages.length) {
      setActivePageIndex(Math.max(0, nextPages.length - 1));
    }

    recordHistory(nextAnnotations, editableSpansByPage, nextPages);
    toast.info('Page deleted', `Removed page ${index + 1}`);
  };

  const handleAddBlankPage = () => {
    const newPage: PageInfo = {
      pageIndex: pages.length,
      width: 595,
      height: 842,
      rotation: 0,
      originalRotation: 0,
      aspectRatio: 595 / 842,
    };
    const nextPages = [...pages, newPage];
    setPages(nextPages);
    setEditableSpansByPage((prev) => ({ ...prev, [newPage.pageIndex]: [] }));
    recordHistory(annotations, editableSpansByPage, nextPages);
    toast.success('Blank page added', 'Standard A4 page inserted.');
  };

  // Thumbnail click -> smooth scroll to page
  const handleSelectThumbnail = (index: number) => {
    setActivePageIndex(index);
    const el = document.getElementById(`nuvio-page-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const debounceHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Text Spans update - immediately syncs document model while debouncing undo/redo snapshots
  const handleUpdateTextSpan = (updatedSpan: EditableTextSpan) => {
    const currentList = editableSpansByPage[updatedSpan.pageIndex] || [];
    const nextList = currentList.map((s) => (s.id === updatedSpan.id ? updatedSpan : s));
    const nextSpansByPage = {
      ...editableSpansByPage,
      [updatedSpan.pageIndex]: nextList,
    };
    setEditableSpansByPage(nextSpansByPage);
    triggerAutosave(annotations, nextSpansByPage, pages);

    if (debounceHistoryTimerRef.current) {
      clearTimeout(debounceHistoryTimerRef.current);
    }
    debounceHistoryTimerRef.current = setTimeout(() => {
      recordHistory(annotations, nextSpansByPage, pages);
    }, 400);
  };

  // OCR on a scanned page
  const handleRunOcrOnPage = async (pageIndex: number) => {
    if (!pdfJsDoc) return;
    toast.info(`Running text recognition on Page ${pageIndex + 1}...`, 'Extracting text from page image...');
    try {
      const page = await pdfJsDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 2.0 });
      const offCanvas = document.createElement('canvas');
      offCanvas.width = viewport.width;
      offCanvas.height = viewport.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const ocrResult = await OcrEngine.recognizeLines(offCanvas);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scaleFactor = unscaledViewport.width / viewport.width;

      const ocrSpans: EditableTextSpan[] = ocrResult.lines.map((line, idx) => ({
        id: `ocr-span-${pageIndex}-${idx}-${Date.now()}`,
        pageIndex,
        originalText: line.text,
        currentText: line.text,
        x: Math.round(line.bbox.x0 * scaleFactor),
        y: Math.round(line.bbox.y0 * scaleFactor),
        width: Math.max(30, Math.round((line.bbox.x1 - line.bbox.x0) * scaleFactor)),
        height: Math.max(16, Math.round((line.bbox.y1 - line.bbox.y0) * scaleFactor)),
        fontSize: Math.round(line.fontSize * scaleFactor) || 14,
        fontFamily: 'Helvetica, sans-serif',
        color: '#0f172a',
        rgbColor: { r: 0.06, g: 0.09, b: 0.16 },
        rotation: 0,
        transformMatrix: [1, 0, 0, 1, 0, 0],
        isModified: false,
        isFromOcr: true,
      }));

      const nextSpansByPage = {
        ...editableSpansByPage,
        [pageIndex]: ocrSpans,
      };
      setEditableSpansByPage(nextSpansByPage);
      setScannedPages((prev) => ({ ...prev, [pageIndex]: false }));
      recordHistory(annotations, nextSpansByPage, pages);

      toast.success(
        `OCR Completed for Page ${pageIndex + 1}`,
        `Detected ${ocrSpans.length} editable text lines.`
      );
    } catch (err: any) {
      toast.error('OCR Processing Failed', err.message || 'Could not parse page image.');
    }
  };

  // Annotation Operations
  const handleAddAnnotation = (annot: AnnotationObject) => {
    const updated = [...annotations, annot];
    setAnnotations(updated);
    recordHistory(updated, editableSpansByPage, pages);
  };

  const handleUpdateAnnotation = (id: string, updatedFields: Partial<AnnotationObject>) => {
    const updated = annotations.map((a) => (a.id === id ? { ...a, ...updatedFields } : a));
    setAnnotations(updated);
  };

  const handleDeleteAnnotation = useCallback(
    (id: string) => {
      const updated = annotations.filter((a) => a.id !== id);
      setAnnotations(updated);
      setSelectedObjectId(null);
      recordHistory(updated, editableSpansByPage, pages);
    },
    [annotations, editableSpansByPage, pages, recordHistory]
  );

  const handleDuplicateAnnotation = useCallback(
    (id: string) => {
      const target = annotations.find((a) => a.id === id);
      if (!target) return;
      const duplicated: AnnotationObject = {
        ...target,
        id: `${target.type}-${Date.now()}`,
        x: target.x + 20,
        y: target.y + 20,
        createdAt: Date.now(),
      };
      const updated = [...annotations, duplicated];
      setAnnotations(updated);
      setSelectedObjectId(duplicated.id);
      recordHistory(updated, editableSpansByPage, pages);
    },
    [annotations, editableSpansByPage, pages, recordHistory]
  );

  const handleBringForward = () => {
    if (!selectedObjectId) return;
    const idx = annotations.findIndex((a) => a.id === selectedObjectId);
    if (idx === -1 || idx === annotations.length - 1) return;
    const updated = [...annotations];
    const [item] = updated.splice(idx, 1);
    updated.push(item);
    setAnnotations(updated);
    recordHistory(updated, editableSpansByPage, pages);
  };

  const handleSendBackward = () => {
    if (!selectedObjectId) return;
    const idx = annotations.findIndex((a) => a.id === selectedObjectId);
    if (idx <= 0) return;
    const updated = [...annotations];
    const [item] = updated.splice(idx, 1);
    updated.unshift(item);
    setAnnotations(updated);
    recordHistory(updated, editableSpansByPage, pages);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setAnnotations(history[nextIndex].annotations);
      setEditableSpansByPage(history[nextIndex].editableSpansByPage);
      setPages(history[nextIndex].pages);
      setSelectedObjectId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setAnnotations(history[nextIndex].annotations);
      setEditableSpansByPage(history[nextIndex].editableSpansByPage);
      setPages(history[nextIndex].pages);
      setSelectedObjectId(null);
    }
  };

  // Clipboard & Object actions
  const handleCopy = useCallback(() => {
    if (selectedObjectId) {
      const obj = annotations.find((a) => a.id === selectedObjectId);
      if (obj) {
        setCopiedObject(obj);
        toast.info('Copied to clipboard', `${obj.type} element copied.`);
      }
    } else if (selectedSpanId) {
      for (const pIdxStr in editableSpansByPage) {
        const s = editableSpansByPage[Number(pIdxStr)]?.find((span) => span.id === selectedSpanId);
        if (s) {
          const virtualObj: AnnotationObject = {
            id: `text-${Date.now()}`,
            type: 'text',
            pageIndex: s.pageIndex,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
            text: s.currentText,
            fontSize: s.fontSize,
            fontFamily: s.fontFamily,
            fontWeight: s.fontWeight,
            fontStyle: s.fontStyle,
            textColor: s.color,
            backgroundColor: s.backgroundColor,
            textAlign: s.textAlign,
            lineHeight: s.lineHeight,
            createdAt: Date.now(),
          };
          setCopiedObject(virtualObj);
          toast.info('Copied text to clipboard', `"${s.currentText.slice(0, 20)}..." copied.`);
          break;
        }
      }
    }
  }, [selectedObjectId, selectedSpanId, annotations, editableSpansByPage, toast]);

  const handlePaste = useCallback(() => {
    if (!copiedObject) return;
    const targetPage = pages[activePageIndex] || pages[0];
    const newAnnot: AnnotationObject = {
      ...copiedObject,
      id: `${copiedObject.type}-${Date.now()}`,
      pageIndex: targetPage ? targetPage.pageIndex : 0,
      x: Math.min(Math.max(20, (targetPage?.width || 500) - copiedObject.width), copiedObject.x + 20),
      y: Math.min(Math.max(20, (targetPage?.height || 700) - copiedObject.height), copiedObject.y + 20),
      createdAt: Date.now(),
    };
    const updated = [...annotations, newAnnot];
    setAnnotations(updated);
    setSelectedObjectId(newAnnot.id);
    setSelectedSpanId(null);
    recordHistory(updated, editableSpansByPage, pages);
    toast.success('Pasted element', `Added ${newAnnot.type} to page ${newAnnot.pageIndex + 1}.`);
  }, [copiedObject, pages, activePageIndex, annotations, editableSpansByPage, recordHistory, toast]);

  const handleDuplicate = useCallback(() => {
    if (selectedObjectId) {
      handleDuplicateAnnotation(selectedObjectId);
    }
  }, [selectedObjectId, handleDuplicateAnnotation]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedObjectId) {
      handleDeleteAnnotation(selectedObjectId);
    }
  }, [selectedObjectId, handleDeleteAnnotation]);

  // Global keyboard shortcuts for Copy, Paste, Duplicate, Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedObjectId || selectedSpanId) {
          e.preventDefault();
          handleCopy();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedObject) {
          e.preventDefault();
          handlePaste();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedObjectId) {
          e.preventDefault();
          handleDuplicate();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, handleDuplicate, handleDeleteSelected, selectedObjectId, selectedSpanId, copiedObject]);

  // List formatting handler
  const handleToggleList = (type: 'bullet' | 'number') => {
    if (selectedSpan) {
      const nextText = toggleListFormatting(selectedSpan.currentText, type);
      const updated: EditableTextSpan = {
        ...selectedSpan,
        currentText: nextText,
        listType: selectedSpan.listType === type ? undefined : type,
        isModified: true,
      };
      handleUpdateTextSpan(updated);
    } else if (selectedObject && selectedObject.type === 'text') {
      const nextText = toggleListFormatting(selectedObject.text || '', type);
      handleUpdateAnnotation(selectedObject.id, {
        text: nextText,
        listType: selectedObject.listType === type ? undefined : type,
      });
    }
  };

  // Image insertion
  const handleInsertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 200;
        const scale = Math.min(maxWidth / img.width, 1);
        const currentPage = pages[activePageIndex] || pages[0];

        const newImgAnnot: AnnotationObject = {
          id: `img-${Date.now()}`,
          type: 'image',
          pageIndex: activePageIndex,
          x: Math.round((currentPage.width - img.width * scale) / 2),
          y: Math.round((currentPage.height - img.height * scale) / 2),
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
          imageDataUrl: dataUrl,
          createdAt: Date.now(),
        };
        handleAddAnnotation(newImgAnnot);
        setSelectedObjectId(newImgAnnot.id);
        setToolMode('select');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Signature insertion
  const handleInsertSignature = (dataUrl: string) => {
    const currentPage = pages[activePageIndex] || pages[0];
    const newSigAnnot: AnnotationObject = {
      id: `sig-${Date.now()}`,
      type: 'signature',
      pageIndex: activePageIndex,
      x: Math.max(20, Math.round((currentPage.width - 200) / 2)),
      y: Math.max(20, Math.round((currentPage.height - 80) / 2)),
      width: 200,
      height: 80,
      imageDataUrl: dataUrl,
      createdAt: Date.now(),
    };
    handleAddAnnotation(newSigAnnot);
    setSelectedObjectId(newSigAnnot.id);
    setToolMode('select');
    toast.success('Signature inserted', 'Drag to position, or resize using corner handles.');
  };

  // Stamp insertion
  const handleInsertStamp = (stampText: string, stampType?: string, color?: string) => {
    const currentPage = pages[activePageIndex] || pages[0];
    const defaultColor = ['REJECTED', 'CONFIDENTIAL'].includes(stampText) ? '#dc2626' : '#16a34a';
    const stampColor = color || defaultColor;
    const actualText =
      stampText && stampText !== 'CUSTOM'
        ? stampText
        : stampType && stampType !== 'CUSTOM'
        ? stampType
        : 'APPROVED';
    const newStamp: AnnotationObject = {
      id: `stamp-${Date.now()}`,
      type: 'stamp',
      pageIndex: activePageIndex,
      x: Math.max(20, Math.round((currentPage.width - 160) / 2)),
      y: Math.max(20, Math.round((currentPage.height - 60) / 2)),
      width: 160,
      height: 60,
      stampType: (stampType as any) || 'CUSTOM',
      stampText: actualText,
      strokeColor: stampColor,
      textColor: stampColor,
      rotation: -12,
      createdAt: Date.now(),
    };
    handleAddAnnotation(newStamp);
    setSelectedObjectId(newStamp.id);
    setToolMode('select');
  };

  // Watermark insertion
  const handleInsertWatermark = (options: WatermarkOptions) => {
    const targetPageList =
      options.targetPages === 'current'
        ? [pages[activePageIndex] || pages[0]].filter(Boolean)
        : pages;

    // Filter out previous watermarks on target pages
    const targetPageIndices = new Set(targetPageList.map((p) => p.pageIndex));
    const updated = annotations.filter(
      (a) => a.type !== 'watermark' || !targetPageIndices.has(a.pageIndex)
    );

    targetPageList.forEach((p) => {
      let width = p.width * 0.8;
      let height = 120;

      if (options.type === 'image') {
        const size = options.imageSize || 200;
        width = size;
        height = size;
      }

      let x = (p.width - width) / 2;
      let y = (p.height - height) / 2;

      if (options.position === 'tile') {
        const tileW = options.type === 'image' ? width : Math.min(width, p.width * 0.35);
        const tileH = options.type === 'image' ? height : 80;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const tileX = (p.width / 3) * col + (p.width / 6) - (tileW / 2);
            const tileY = (p.height / 3) * row + (p.height / 6) - (tileH / 2);
            updated.push({
              id: `wm-${p.pageIndex}-${row}-${col}-${Date.now()}`,
              type: 'watermark',
              pageIndex: p.pageIndex,
              x: Math.max(0, Math.round(tileX)),
              y: Math.max(0, Math.round(tileY)),
              width: Math.round(tileW),
              height: Math.round(tileH),
              watermarkType: options.type,
              watermarkPosition: options.position,
              watermarkTargetPages: options.targetPages,
              text: options.type === 'text' ? options.text : undefined,
              imageDataUrl: options.type === 'image' ? options.imageDataUrl : undefined,
              fontSize: options.fontSize ? Math.round(options.fontSize * 0.7) : 36,
              textColor: options.color || '#dc2626',
              opacity: options.opacity !== undefined ? options.opacity : 0.25,
              rotation: options.rotation !== undefined ? options.rotation : -45,
              createdAt: Date.now(),
            });
          }
        }
        return;
      }

      if (options.position === 'top-left') {
        x = 40;
        y = 40;
      } else if (options.position === 'top-right') {
        x = p.width - width - 40;
        y = 40;
      } else if (options.position === 'bottom-left') {
        x = 40;
        y = p.height - height - 40;
      } else if (options.position === 'bottom-right') {
        x = p.width - width - 40;
        y = p.height - height - 40;
      }

      updated.push({
        id: `wm-${p.pageIndex}-${Date.now()}`,
        type: 'watermark',
        pageIndex: p.pageIndex,
        x: Math.max(0, Math.round(x)),
        y: Math.max(0, Math.round(y)),
        width: Math.round(width),
        height: Math.round(height),
        watermarkType: options.type,
        watermarkPosition: options.position,
        watermarkTargetPages: options.targetPages,
        text: options.type === 'text' ? options.text : undefined,
        imageDataUrl: options.type === 'image' ? options.imageDataUrl : undefined,
        fontSize: options.fontSize || 54,
        textColor: options.color || '#dc2626',
        opacity: options.opacity !== undefined ? options.opacity : 0.25,
        rotation: options.rotation !== undefined ? options.rotation : -45,
        createdAt: Date.now(),
      });
    });

    setAnnotations(updated);
    recordHistory(updated, editableSpansByPage, pages);
    toast.success(
      'Watermark applied',
      options.targetPages === 'current'
        ? `Added watermark to page ${activePageIndex + 1}.`
        : `Added watermark to all ${pages.length} pages.`
    );
  };

  // Validate & Export document
  const handleExport = async () => {
    if (!pdfBytes) return;

    if (debounceHistoryTimerRef.current) {
      clearTimeout(debounceHistoryTimerRef.current);
      recordHistory(annotations, editableSpansByPage, pages);
    }

    setIsExporting(true);
    setExportStep('Neutralizing modified text & injecting replacements...');

    try {
      // 1. Burn all text replacements and annotations
      const processedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        pdfBytes,
        annotations,
        editableSpansByPage
      );

      setExportStep('Inspecting document fidelity & structure...');
      // 2. Automated quality check via ValidationEngine
      const report = await ValidationEngine.validatePdf(processedPdfBytes);
      setLatestReport(report);

      setExportStep('Finalizing download...');
      // 3. Trigger local download
      const blob = new Blob([processedPdfBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-edited.pdf';
      saveAs(blob, finalName);

      toast.success('PDF Export Complete', `Saved ${finalName} (${report.score}% fidelity score)`);
    } catch (e: any) {
      toast.error('Export Failed', e.message || 'Error compiling PDF document.');
    } finally {
      setIsExporting(false);
      setExportStep('');
    }
  };

  // Insert Text Box
  const handleInsertTextBox = () => {
    const currentPage = pages[activePageIndex] || pages[0];
    const newTextBox: AnnotationObject = {
      id: `text-${Date.now()}`,
      type: 'text',
      pageIndex: activePageIndex,
      x: Math.max(20, Math.round(((currentPage?.width || 595) - 180) / 2)),
      y: Math.max(20, Math.round(((currentPage?.height || 842) - 60) / 2)),
      width: 180,
      height: 50,
      text: 'Type text here',
      fontSize: 14,
      fontFamily: 'Helvetica, Arial, sans-serif',
      textColor: '#0f172a',
      textAlign: 'left',
      createdAt: Date.now(),
    };
    handleAddAnnotation(newTextBox);
    setSelectedObjectId(newTextBox.id);
    setSelectedSpanId(null);
    setToolMode('select');
    toast.success('Text Box added', 'Drag to position, or use toolbar to format.');
  };

  const selectedObject = selectedObjectId
    ? annotations.find((a) => a.id === selectedObjectId) || null
    : null;

  const selectedSpan = selectedSpanId
    ? Object.values(editableSpansByPage).flatMap((list) => list).find((span) => span.id === selectedSpanId) || null
    : null;

  // Active text style resolution for the Google Docs Rich Text Formatting Bar
  const activeTextStyle: TextStyleProps = useMemo(() => {
    if (selectedSpan) {
      return {
        fontFamily: selectedSpan.fontFamily || 'Helvetica, Arial, sans-serif',
        fontSize: selectedSpan.fontSize || 12,
        fontWeight: selectedSpan.fontWeight || 'normal',
        fontStyle: selectedSpan.fontStyle || 'normal',
        underline: !!selectedSpan.underline,
        strikethrough: !!selectedSpan.strikethrough,
        color: selectedSpan.color || '#0f172a',
        backgroundColor: selectedSpan.backgroundColor || '',
        textAlign: (selectedSpan.textAlign as any) || 'left',
        verticalAlign: selectedSpan.verticalAlign || 'baseline',
        letterSpacing: selectedSpan.letterSpacing || 0,
        lineHeight: selectedSpan.lineHeight || 1.2,
      };
    }
    if (selectedObject && selectedObject.type === 'text') {
      return {
        fontFamily: selectedObject.fontFamily || 'Helvetica, Arial, sans-serif',
        fontSize: selectedObject.fontSize || 14,
        fontWeight: selectedObject.fontWeight || 'normal',
        fontStyle: selectedObject.fontStyle || 'normal',
        underline: !!selectedObject.underline,
        strikethrough: !!selectedObject.strikethrough,
        color: selectedObject.textColor || '#0f172a',
        backgroundColor: selectedObject.backgroundColor || '',
        textAlign: (selectedObject.textAlign as any) || 'left',
        verticalAlign: selectedObject.verticalAlign || 'baseline',
        letterSpacing: selectedObject.letterSpacing || 0,
        lineHeight: selectedObject.lineHeight || 1.2,
      };
    }
    return {
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
  }, [selectedSpan, selectedObject]);

  const handleUpdateActiveTextStyle = (updates: Partial<TextStyleProps>) => {
    if (selectedSpan) {
      // Sync rgbColor if the user explicitly changed the hex color
      let nextRgbColor = selectedSpan.rgbColor;
      if (updates.color && updates.color !== selectedSpan.color) {
        const hex = updates.color.replace('#', '');
        const num = parseInt(hex, 16);
        if (!isNaN(num)) {
          nextRgbColor = {
            r: ((num >> 16) & 255) / 255,
            g: ((num >> 8) & 255) / 255,
            b: (num & 255) / 255,
          };
        }
      }

      const updated: EditableTextSpan = {
        ...selectedSpan,
        fontFamily: updates.fontFamily ?? selectedSpan.fontFamily,
        fontSize: updates.fontSize ?? selectedSpan.fontSize,
        fontWeight: (updates.fontWeight as any) ?? selectedSpan.fontWeight,
        fontStyle: (updates.fontStyle as any) ?? selectedSpan.fontStyle,
        underline: updates.underline !== undefined ? updates.underline : selectedSpan.underline,
        strikethrough: updates.strikethrough !== undefined ? updates.strikethrough : selectedSpan.strikethrough,
        color: updates.color ?? selectedSpan.color,
        rgbColor: nextRgbColor,
        backgroundColor: updates.backgroundColor !== undefined ? updates.backgroundColor : selectedSpan.backgroundColor,
        textAlign: updates.textAlign ?? selectedSpan.textAlign,
        verticalAlign: updates.verticalAlign ?? selectedSpan.verticalAlign,
        letterSpacing: updates.letterSpacing !== undefined ? updates.letterSpacing : selectedSpan.letterSpacing,
        lineHeight: updates.lineHeight ?? selectedSpan.lineHeight,
        isModified: true,
      };
      handleUpdateTextSpan(updated);
    } else if (selectedObject && selectedObject.type === 'text') {
      handleUpdateAnnotation(selectedObject.id, {
        fontFamily: updates.fontFamily ?? selectedObject.fontFamily,
        fontSize: updates.fontSize ?? selectedObject.fontSize,
        fontWeight: (updates.fontWeight as any) ?? selectedObject.fontWeight,
        fontStyle: (updates.fontStyle as any) ?? selectedObject.fontStyle,
        underline: updates.underline !== undefined ? updates.underline : selectedObject.underline,
        strikethrough: updates.strikethrough !== undefined ? updates.strikethrough : selectedObject.strikethrough,
        textColor: updates.color ?? selectedObject.textColor,
        backgroundColor: updates.backgroundColor !== undefined ? updates.backgroundColor : selectedObject.backgroundColor,
        textAlign: updates.textAlign ?? selectedObject.textAlign,
        verticalAlign: updates.verticalAlign ?? selectedObject.verticalAlign,
        letterSpacing: updates.letterSpacing !== undefined ? updates.letterSpacing : selectedObject.letterSpacing,
      });
    }
  };

  const handleToggleFormatPainter = () => {
    if (isFormatPainterActive) {
      setIsFormatPainterActive(false);
      return;
    }
    setCopiedStyle({
      fontFamily: activeTextStyle.fontFamily,
      fontSize: activeTextStyle.fontSize,
      fontWeight: activeTextStyle.fontWeight as any,
      fontStyle: activeTextStyle.fontStyle as any,
      underline: activeTextStyle.underline,
      strikethrough: activeTextStyle.strikethrough,
      color: activeTextStyle.color,
      backgroundColor: activeTextStyle.backgroundColor,
      textAlign: activeTextStyle.textAlign,
      verticalAlign: activeTextStyle.verticalAlign,
      letterSpacing: activeTextStyle.letterSpacing,
      lineHeight: activeTextStyle.lineHeight,
    });
    setIsFormatPainterActive(true);
    toast.info('Format Painter Active', 'Click any text span to apply copied formatting.');
  };

  const handleApplyFormatPainterToSpan = (targetSpan: EditableTextSpan) => {
    if (!copiedStyle) return;
    const updated: EditableTextSpan = {
      ...targetSpan,
      fontFamily: copiedStyle.fontFamily ?? targetSpan.fontFamily,
      fontSize: copiedStyle.fontSize ?? targetSpan.fontSize,
      fontWeight: (copiedStyle.fontWeight as any) ?? targetSpan.fontWeight,
      fontStyle: (copiedStyle.fontStyle as any) ?? targetSpan.fontStyle,
      underline: copiedStyle.underline !== undefined ? copiedStyle.underline : targetSpan.underline,
      strikethrough: copiedStyle.strikethrough !== undefined ? copiedStyle.strikethrough : targetSpan.strikethrough,
      color: copiedStyle.color ?? targetSpan.color,
      backgroundColor: copiedStyle.backgroundColor !== undefined ? copiedStyle.backgroundColor : targetSpan.backgroundColor,
      textAlign: copiedStyle.textAlign ?? targetSpan.textAlign,
      verticalAlign: copiedStyle.verticalAlign ?? targetSpan.verticalAlign,
      letterSpacing: copiedStyle.letterSpacing !== undefined ? copiedStyle.letterSpacing : targetSpan.letterSpacing,
      lineHeight: copiedStyle.lineHeight ?? targetSpan.lineHeight,
      isModified: true,
    };
    handleUpdateTextSpan(updated);
    setIsFormatPainterActive(false);
    toast.success('Style Applied', 'Copied text formatting applied.');
  };

  const handleResetSpan = () => {
    if (!selectedSpan) return;
    const reverted: EditableTextSpan = {
      ...selectedSpan,
      currentText: selectedSpan.originalText,
      fontSize: selectedSpan.fontSize,
      fontFamily: 'Helvetica, sans-serif',
      color: '#0f172a',
      backgroundColor: undefined,
      fontWeight: 'normal',
      fontStyle: 'normal',
      underline: false,
      strikethrough: false,
      isModified: false,
    };
    handleUpdateTextSpan(reverted);
    toast.info('Text Reset', 'Reverted span to original PDF text.');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* 1. Header Bar */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              PDF Editor
            </span>
            {pdfBytes && (
              <span className="text-xs text-slate-500 max-w-[200px] truncate" title={fileName}>
                — {fileName}
              </span>
            )}
            {/* Autosave Status Badge */}
            {pdfBytes && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                title="Changes are automatically saved locally"
              >
                {autosaveStatus === 'saving' && (
                  <>
                    <Loader2 className="w-3 h-3 text-brand-500 animate-spin" />
                    <span className="text-slate-600 dark:text-slate-300">Saving...</span>
                  </>
                )}
                {autosaveStatus === 'saved' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">Saved</span>
                  </>
                )}
                {autosaveStatus === 'unsaved' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-700 dark:text-amber-400">Unsaved changes</span>
                  </>
                )}
                {autosaveStatus === 'error' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-red-700 dark:text-red-400">Save error</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {latestReport && (
            <ValidationBadge report={latestReport} onClick={() => setIsValidationModalOpen(true)} />
          )}

          {pdfBytes && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangeFile}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Change File
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={!pdfBytes || isExporting}
            isLoading={isExporting}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            {isExporting ? exportStep || 'Exporting...' : 'Validate & Export PDF'}
          </Button>
        </div>
      </header>

      {/* Main Workspace Area */}
      {!pdfBytes ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <FileDropzone
              accept=".pdf,application/pdf"
              onFilesSelected={handleFileSelected}
              title="Upload PDF to start editing"
              description="All processing runs 100% locally in your browser with zero server uploads."
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* 2. Top Toolbar */}
          <EditorToolbar
            toolMode={toolMode}
            onSetToolMode={setToolMode}
            onInsertTextBox={handleInsertTextBox}
            zoom={zoom}
            onZoomIn={() => setZoom((prev) => Math.min(prev + 0.15, 2.5))}
            onZoomOut={() => setZoom((prev) => Math.max(prev - 0.15, 0.4))}
            onZoomReset={() => setZoom(1.0)}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenSignatureModal={() => setIsSignatureModalOpen(true)}
            onOpenStampModal={() => setIsStampModalOpen(true)}
            onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
            onInsertImage={handleInsertImage}
            onValidateAndExport={handleExport}
            isExporting={isExporting}
            activeTextStyle={activeTextStyle}
            onUpdateTextStyle={handleUpdateActiveTextStyle}
            onToggleList={handleToggleList}
            isTextSelected={!!selectedSpan || (!!selectedObject && selectedObject.type === 'text')}
            isFormatPainterActive={isFormatPainterActive}
            onToggleFormatPainter={handleToggleFormatPainter}
            hasCopiedStyle={!!copiedStyle}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteSelected}
            canCopy={!!selectedObjectId || !!selectedSpanId}
            canPaste={!!copiedObject}
            canDelete={!!selectedObjectId}
          />

          {/* 3. Three-column continuous workspace */}
          <div className="flex-1 flex min-h-0 relative">
            {/* Left Page Thumbnails Panel */}
            <EditorThumbnails
              pages={pages}
              currentPageIndex={activePageIndex}
              onSelectPage={handleSelectThumbnail}
              onRotatePage={handleRotatePage}
              onDuplicatePage={handleDuplicatePage}
              onDeletePage={handleDeletePage}
              onAddBlankPage={handleAddBlankPage}
            />

            {/* Central Continuous Multi-Page Document Canvas */}
            <EditorCanvas
              pdfJsDoc={pdfJsDoc}
              pages={pages}
              activePageIndex={activePageIndex}
              zoom={zoom}
              toolMode={toolMode}
              annotations={annotations}
              selectedObjectId={selectedObjectId}
              selectedSpanId={selectedSpanId}
              editableSpansByPage={editableSpansByPage}
              scannedPages={scannedPages}
              isFormatPainterActive={isFormatPainterActive}
              onActivePageIndexChange={setActivePageIndex}
              onSelectObject={(id) => {
                setSelectedObjectId(id);
                if (id) setSelectedSpanId(null);
              }}
              onSelectSpan={(id) => {
                setSelectedSpanId(id);
                if (id) setSelectedObjectId(null);
              }}
              onApplyFormatPainter={handleApplyFormatPainterToSpan}
              onAddAnnotation={handleAddAnnotation}
              onUpdateAnnotation={handleUpdateAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onDuplicateAnnotation={handleDuplicateAnnotation}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
              onUpdateTextSpan={handleUpdateTextSpan}
              onRunOcrOnPage={handleRunOcrOnPage}
            />

            {/* Right Property Panel */}
            <PropertyPanel
              selectedObject={selectedObject}
              selectedSpan={selectedSpan}
              onUpdateObject={(updated) => {
                if (selectedObjectId) handleUpdateAnnotation(selectedObjectId, updated);
              }}
              onUpdateSpan={(updated) => {
                if (selectedSpan) {
                  let nextSpan = { ...selectedSpan, ...updated };
                  if (updated.currentText !== undefined && updated.currentText !== selectedSpan.currentText) {
                    const pageHeight = pages[selectedSpan.pageIndex]?.height || 842;
                    nextSpan = TextObjectModel.syncSpanText(nextSpan, updated.currentText, pageHeight);
                  } else {
                    nextSpan = TextObjectModel.syncSpanStyles(nextSpan);
                  }
                  handleUpdateTextSpan(nextSpan);
                }
              }}
              onDeleteObject={() => {
                if (selectedObjectId) handleDeleteAnnotation(selectedObjectId);
              }}
              onResetSpan={handleResetSpan}
              onDuplicateObject={() => {
                if (selectedObjectId) handleDuplicateAnnotation(selectedObjectId);
              }}
              onBringForward={handleBringForward}
              onSendBackward={handleSendBackward}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onInsertSignature={handleInsertSignature}
      />

      <StampModal
        isOpen={isStampModalOpen}
        onClose={() => setIsStampModalOpen(false)}
        onInsertStamp={handleInsertStamp}
      />

      <WatermarkModal
        isOpen={isWatermarkModalOpen}
        onClose={() => setIsWatermarkModalOpen(false)}
        onApplyWatermark={handleInsertWatermark}
        activePageIndex={activePageIndex}
        pageCount={pages.length}
      />

      <ValidationModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        report={latestReport}
        onConfirmDownload={() => {
          setIsValidationModalOpen(false);
          handleExport();
        }}
      />
    </div>
  );
};
