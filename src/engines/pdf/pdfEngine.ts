import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageInfo, DocumentMetadata, EditableTextSpan } from '../../types/document';
import { TextObjectModel } from './textObjectModel';

// Ensure worker is registered
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
}

// Track in-flight render operations per canvas to prevent concurrency collisions
const activeCanvasRenderTasks = new WeakMap<HTMLCanvasElement, { cancel: () => void; promise: Promise<any> }>();

export class PdfEngine {
  /**
   * Loads a PDF Document Proxy using pdfjsLib for rendering and inspection.
   */
  static async loadPdfJsDoc(pdfBytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    return await loadingTask.promise;
  }

  /**
   * Extracts metadata and page info.
   */
  static async getPdfInfo(
    pdfBytes: Uint8Array,
    fileName: string = 'document.pdf'
  ): Promise<{
    pageCount: number;
    totalPages: number;
    metadata: DocumentMetadata;
    pages: PageInfo[];
  }> {
    const pdfDoc = await this.loadPdfJsDoc(pdfBytes);
    const pageCount = pdfDoc.numPages;

    let title: string | undefined;
    let author: string | undefined;
    let creator: string | undefined;

    try {
      const meta = await pdfDoc.getMetadata();
      const info = meta.info as any;
      if (info) {
        title = info.Title;
        author = info.Author;
        creator = info.Creator;
      }
    } catch {
      // Ignore metadata parsing issues
    }

    const pages: PageInfo[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      pages.push({
        pageIndex: i - 1,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation,
        originalRotation: viewport.rotation,
        aspectRatio: viewport.width / viewport.height,
      });
    }

    return {
      pageCount,
      totalPages: pageCount,
      metadata: {
        fileName,
        fileSizeBytes: pdfBytes.byteLength,
        pageCount,
        title,
        author,
        creator,
      },
      pages,
    };
  }

  /**
   * Extracts detailed text spans with styles, coordinates, font info, and colors for interactive editing.
   * Uses proper graphics state tracking for color extraction and preserves original PDF font names.
   */
  static async extractPageTextSpans(
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number // 1-indexed
  ): Promise<{ textSpans: EditableTextSpan[]; isScanned: boolean }> {
    const page = await pdfJsDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent({ includeMarkedContent: true });

    // -------------------------------------------------------------------
    // Operator list tracking: color, font resource, and op index
    // -------------------------------------------------------------------
    const opList = await page.getOperatorList();

    interface OpTextSnapshot {
      color: { r: number; g: number; b: number };
      fontResource: string;
      fontSize: number;
      opIndex: number;
    }
    const opSnapshots: OpTextSnapshot[] = [];
    let currentFill = { r: 0.06, g: 0.09, b: 0.16 }; // default near-black
    let currentFontResource = '';
    let currentFontSize = 12;
    const gStateStack: { fill: { r: number; g: number; b: number }; fontResource: string; fontSize: number }[] = [];
    let hasImage = false;

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      // Graphics state save
      if (fn === pdfjsLib.OPS.save) {
        gStateStack.push({
          fill: { ...currentFill },
          fontResource: currentFontResource,
          fontSize: currentFontSize,
        });
      }
      // Graphics state restore
      else if (fn === pdfjsLib.OPS.restore) {
        if (gStateStack.length > 0) {
          const popped = gStateStack.pop()!;
          currentFill = popped.fill;
          currentFontResource = popped.fontResource;
          currentFontSize = popped.fontSize;
        }
      }
      // setFont (Tf)
      else if (fn === pdfjsLib.OPS.setFont && args) {
        if (typeof args[0] === 'string') currentFontResource = args[0];
        if (typeof args[1] === 'number') currentFontSize = args[1];
      }
      // setFillRGBColor (rg / RG)
      else if (fn === pdfjsLib.OPS.setFillRGBColor && args) {
        const r = args[0] > 1 ? args[0] / 255 : args[0];
        const g = args[1] > 1 ? args[1] / 255 : args[1];
        const b = args[2] > 1 ? args[2] / 255 : args[2];
        currentFill = { r, g, b };
      }
      // setFillGray (g / G)
      else if (fn === pdfjsLib.OPS.setFillGray && args) {
        const val = args[0] > 1 ? args[0] / 255 : args[0];
        currentFill = { r: val, g: val, b: val };
      }
      // setFillCMYKColor (k / K)
      else if (fn === (pdfjsLib.OPS as any).setFillCMYKColor && args) {
        const c = args[0], m = args[1], y = args[2], k = args[3];
        currentFill = {
          r: (1 - c) * (1 - k),
          g: (1 - m) * (1 - k),
          b: (1 - y) * (1 - k),
        };
      }
      // Any text-showing operator: snapshot graphics state
      else if (
        fn === pdfjsLib.OPS.showText ||
        fn === pdfjsLib.OPS.showSpacedText ||
        fn === (pdfjsLib.OPS as any).showSpans ||
        fn === pdfjsLib.OPS.nextLineShowText ||
        fn === pdfjsLib.OPS.nextLineSetSpacingShowText
      ) {
        opSnapshots.push({
          color: { ...currentFill },
          fontResource: currentFontResource,
          fontSize: currentFontSize,
          opIndex: i,
        });
      }
      // Image detection
      else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
        hasImage = true;
      }
    }

    // -------------------------------------------------------------------
    // Build text spans with proper font & color metadata
    // -------------------------------------------------------------------
    const textSpans: EditableTextSpan[] = [];
    let textCharCount = 0;
    let colorIdx = 0;

    for (let idx = 0; idx < textContent.items.length; idx++) {
      const item = textContent.items[idx] as any;
      if (!item || !item.str || item.str.trim() === '') {
        // Even empty items may correspond to a text-showing op, advance color index
        if (item && item.str !== undefined) colorIdx++;
        continue;
      }

      const str = item.str;
      textCharCount += str.trim().length;

      // Transform matrix: [scaleX, skewY, skewX, scaleY, transX, transY]
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const transX = transform[4];
      const transY = transform[5];

      // Font size: prefer item.height (set by pdf.js from the actual Tf size),
      // fall back to transform matrix analysis
      const rawFontSize = item.height
        ? item.height
        : Math.abs(transform[3]) || Math.hypot(transform[0], transform[1]) || 12;
      const fontSize = Math.max(1, rawFontSize);

      const width = item.width || fontSize * str.length * 0.55;
      const height = item.height || fontSize * 1.15;

      // Convert from PDF bottom-left to canvas top-left coordinates
      const x = transX;
      const y = viewport.height - transY - fontSize;

      // Color and operator binding snapshot
      const opSnapshot = opSnapshots[colorIdx] || {
        color: currentFill,
        fontResource: item.fontName || '',
        fontSize,
        opIndex: idx,
      };
      const rgbColor = opSnapshot.color;
      colorIdx++;

      const rHex = Math.round(Math.min(1, Math.max(0, rgbColor.r)) * 255).toString(16).padStart(2, '0');
      const gHex = Math.round(Math.min(1, Math.max(0, rgbColor.g)) * 255).toString(16).padStart(2, '0');
      const bHex = Math.round(Math.min(1, Math.max(0, rgbColor.b)) * 255).toString(16).padStart(2, '0');
      const hexColor = `#${rHex}${gHex}${bHex}`;

      // Font detection: preserve raw PDF font name and detect CSS-friendly family
      const style = (textContent.styles && item.fontName) ? (textContent.styles as any)[item.fontName] : null;
      const rawFontName = style?.fontFamily || item.fontName || 'Helvetica';
      const pdfFontName = item.fontName || ''; // exact PDF internal name for export font reuse
      let isBold = false;
      let isItalic = false;

      // Try commonObjs for font metadata
      try {
        const commonObj = (page as any).commonObjs?.get?.(item.fontName);
        if (commonObj) {
          if (commonObj.bold) isBold = true;
          if (commonObj.italic) isItalic = true;
        }
      } catch {
        // ignore
      }

      // Heuristic weight/style detection from font name
      const fontNameLower = (rawFontName + ' ' + pdfFontName).toLowerCase();
      if (
        fontNameLower.includes('bold') ||
        fontNameLower.includes('black') ||
        fontNameLower.includes('heavy') ||
        fontNameLower.includes('semibold') ||
        fontNameLower.includes('700') ||
        fontNameLower.includes('800') ||
        fontNameLower.includes('900')
      ) {
        isBold = true;
      }
      if (
        fontNameLower.includes('italic') ||
        fontNameLower.includes('oblique') ||
        fontNameLower.includes('slant')
      ) {
        isItalic = true;
      }

      // Expanded font family detection with more granular matching
      let detectedFamily = 'Helvetica, Arial, sans-serif';
      if (
        fontNameLower.includes('courier') ||
        fontNameLower.includes('mono') ||
        fontNameLower.includes('consolas') ||
        fontNameLower.includes('menlo') ||
        fontNameLower.includes('lucida console') ||
        fontNameLower.includes('source code')
      ) {
        detectedFamily = 'Courier New, Courier, monospace';
      } else if (fontNameLower.includes('garamond')) {
        detectedFamily = 'Garamond, Georgia, serif';
      } else if (fontNameLower.includes('palatino') || fontNameLower.includes('book antiqua')) {
        detectedFamily = 'Palatino Linotype, Palatino, serif';
      } else if (fontNameLower.includes('georgia')) {
        detectedFamily = 'Georgia, serif';
      } else if (fontNameLower.includes('cambria')) {
        detectedFamily = 'Cambria, serif';
      } else if (fontNameLower.includes('calibri')) {
        detectedFamily = 'Calibri, Helvetica, sans-serif';
      } else if (fontNameLower.includes('verdana')) {
        detectedFamily = 'Verdana, Geneva, sans-serif';
      } else if (fontNameLower.includes('tahoma')) {
        detectedFamily = 'Tahoma, Geneva, sans-serif';
      } else if (fontNameLower.includes('trebuchet')) {
        detectedFamily = 'Trebuchet MS, sans-serif';
      } else if (
        fontNameLower.includes('times') ||
        fontNameLower.includes('roman') ||
        fontNameLower.includes('serif')
      ) {
        // "serif" but not the ones caught above
        if (!fontNameLower.includes('sans')) {
          detectedFamily = 'Times New Roman, Times, serif';
        }
      } else if (fontNameLower.includes('arial')) {
        detectedFamily = 'Arial, Helvetica, sans-serif';
      }

      const spanObj: EditableTextSpan = {
        id: `span-${pageNumber}-${idx}-${Date.now()}`,
        pageIndex: pageNumber - 1,
        streamIndex: 0,
        opIndex: opSnapshot.opIndex,
        sourceOperatorReference: { streamIndex: 0, opIndex: opSnapshot.opIndex, operandIndex: 0 },
        sourceTextItemReference: `item-${idx}`,
        fontResourceName: opSnapshot.fontResource || pdfFontName,
        rawTextMatrix: transform,
        rawOperandType: 'literal',
        originalText: str,
        currentText: str,
        originalFont: opSnapshot.fontResource || pdfFontName || 'Helvetica',
        resolvedFont: detectedFamily,
        x: Math.max(0, x),
        y: Math.max(0, y),
        pdfX: transX,
        pdfY: transY,
        width: Math.max(20, width),
        height: Math.max(fontSize, height),
        fontSize: Math.round(fontSize),
        originalFontSize: fontSize,
        fontFamily: detectedFamily,
        pdfFontName,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        color: hexColor,
        fillColor: hexColor,
        originalColor: hexColor,
        rgbColor,
        backgroundColor: undefined, // no default — preserve page background
        rotation: 0,
        transformMatrix: transform,
        textMatrix: transform,
        baseline: transY,
        characterSpacing: (item as any).charSpacing || 0,
        wordSpacing: (item as any).wordSpacing || 0,
        horizontalScale: 100,
        lineHeight: Math.max(fontSize, height),
        renderingMode: 0,
        originalBoundingBox: {
          x: transX,
          y: transY,
          width: Math.max(20, width),
          height: Math.max(fontSize, height),
        },
        currentBoundingBox: {
          x: transX,
          y: transY,
          width: Math.max(20, width),
          height: Math.max(fontSize, height),
        },
        bbox: {
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.max(20, width),
          height: Math.max(fontSize, height),
        },
        isModified: false,
      };

      // Deconstruct into discrete words for precision editing
      spanObj.words = TextObjectModel.tokenizeSpanIntoWords(spanObj, viewport.height);
      textSpans.push(spanObj);
    }

    const isScanned = textCharCount < 10 && hasImage;
    return { textSpans, isScanned };
  }

  /**
   * Renders a specific page into an HTML Canvas.
   */
  static async renderPageToCanvas(
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number, // 1-indexed
    canvas: HTMLCanvasElement,
    scale: number = 1.0,
    rotation: number = 0
  ): Promise<{ width: number; height: number }> {
    const page = await pdfJsDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');

    // Cancel any existing in-flight render task on the exact same canvas
    const activeTask = activeCanvasRenderTasks.get(canvas);
    if (activeTask) {
      try {
        activeTask.cancel();
        await activeTask.promise;
      } catch {
        // Ignore cancellation error from previous task
      }
    }

    // Handle high DPI displays
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = viewport.width * pixelRatio;
    canvas.height = viewport.height * pixelRatio;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    context.save();
    context.scale(pixelRatio, pixelRatio);

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    const renderTask = page.render(renderContext);
    activeCanvasRenderTasks.set(canvas, {
      cancel: () => {
        try {
          renderTask.cancel();
        } catch {
          // Ignore
        }
      },
      promise: renderTask.promise,
    });

    try {
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
        return { width: viewport.width, height: viewport.height };
      }
      throw err;
    } finally {
      context.restore();
      if (activeCanvasRenderTasks.get(canvas)?.promise === renderTask.promise) {
        activeCanvasRenderTasks.delete(canvas);
      }
    }

    return { width: viewport.width, height: viewport.height };
  }

  /**
   * Generates a high quality thumbnail data URL for a page.
   */
  static async generateThumbnail(
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    maxWidth: number = 200
  ): Promise<string> {
    const page = await pdfJsDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = maxWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = viewport.width;
    offscreenCanvas.height = viewport.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return '';

    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.85);

    // Clean up
    offscreenCanvas.width = 0;
    offscreenCanvas.height = 0;
    return dataUrl;
  }

  /**
   * Merges multiple PDF binaries into a single PDF.
   */
  static async mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
    const mergedDoc = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }

    return await mergedDoc.save();
  }

  /**
   * Extracts specified page indices into a new PDF.
   */
  static async extractPages(pdfBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();

    const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < srcDoc.getPageCount());
    const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    return await newDoc.save();
  }

  /**
   * Splits a PDF into multiple documents by range or individual pages.
   */
  static async splitPdf(
    pdfBytes: Uint8Array,
    rangesOrOptions: { start: number; end: number }[] | { mode: 'all' }
  ): Promise<Uint8Array[]> {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    let ranges: { start: number; end: number }[] = [];

    if (!Array.isArray(rangesOrOptions) && (rangesOrOptions as any)?.mode === 'all') {
      ranges = Array.from({ length: totalPages }, (_, i) => ({ start: i, end: i }));
    } else if (Array.isArray(rangesOrOptions)) {
      ranges = rangesOrOptions;
    } else {
      ranges = Array.from({ length: totalPages }, (_, i) => ({ start: i, end: i }));
    }

    const results: Uint8Array[] = [];
    for (const range of ranges) {
      const newDoc = await PDFDocument.create();
      const pageIndices: number[] = [];
      const start = Math.max(0, range.start);
      const end = Math.min(totalPages - 1, range.end);

      for (let i = start; i <= end; i++) {
        pageIndices.push(i);
      }

      if (pageIndices.length > 0) {
        const copied = await newDoc.copyPages(srcDoc, pageIndices);
        for (const page of copied) {
          newDoc.addPage(page);
        }
        results.push(await newDoc.save());
      }
    }

    return results;
  }

  /**
   * Deletes specified pages from a document.
   */
  static async deletePages(
    pdfBytes: Uint8Array,
    pageIndicesToDelete: number[]
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const toDeleteSet = new Set(pageIndicesToDelete);
    const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !toDeleteSet.has(i));
    if (keepIndices.length === 0) {
      throw new Error('Cannot delete all pages from PDF.');
    }
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }
    return await newDoc.save();
  }

  /**
   * Reorders, rotates, duplicates, or deletes pages in a single unified operation.
   */
  static async reorderAndModifyPages(
    pdfBytes: Uint8Array,
    pageOperations: {
      originalIndex: number;
      rotationDelta?: number; // 0, 90, 180, 270
    }[]
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();

    for (const op of pageOperations) {
      const [copiedPage] = await newDoc.copyPages(srcDoc, [op.originalIndex]);
      if (op.rotationDelta) {
        const currentRotation = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRotation + op.rotationDelta) % 360));
      }
      newDoc.addPage(copiedPage);
    }

    return await newDoc.save();
  }

  /**
   * Rotates all or specific pages.
   */
  static async rotatePages(
    pdfBytes: Uint8Array,
    pageRotationsOrIndices: Record<number, number> | number[],
    angleDelta?: number
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    if (Array.isArray(pageRotationsOrIndices)) {
      const delta = angleDelta !== undefined ? angleDelta : 90;
      for (const idx of pageRotationsOrIndices) {
        if (idx >= 0 && idx < pages.length) {
          const page = pages[idx];
          const currentAngle = page.getRotation().angle;
          page.setRotation(degrees((currentAngle + delta) % 360));
        }
      }
    } else {
      for (const [indexStr, delta] of Object.entries(pageRotationsOrIndices)) {
        const idx = parseInt(indexStr, 10);
        if (idx >= 0 && idx < pages.length) {
          const page = pages[idx];
          const currentAngle = page.getRotation().angle;
          page.setRotation(degrees((currentAngle + delta) % 360));
        }
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Adds page numbers to pages.
   */
  static async addPageNumbers(
    pdfBytes: Uint8Array,
    options: {
      position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
      format?: string; // e.g. "Page {n} of {total}" or "{n}"
      fontSize?: number;
      fontColor?: { r: number; g: number; b: number };
      startNumber?: number;
      margin?: number;
    }
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    const fontSize = options.fontSize || 10;
    const margin = options.margin || 24;
    const format = options.format || 'Page {n} of {total}';
    const color = options.fontColor ? rgb(options.fontColor.r, options.fontColor.g, options.fontColor.b) : rgb(0.3, 0.3, 0.3);
    const startNum = options.startNumber || 1;

    for (let i = 0; i < total; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const currentNumber = startNum + i;
      const text = format.replace('{n}', currentNumber.toString()).replace('{total}', total.toString());
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      let x = margin;
      let y = margin;

      // X coordinate
      if (options.position.includes('center')) {
        x = (width - textWidth) / 2;
      } else if (options.position.includes('right')) {
        x = width - textWidth - margin;
      }

      // Y coordinate
      if (options.position.startsWith('top')) {
        y = height - margin - fontSize;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color,
      });
    }

    return await pdfDoc.save();
  }

  /**
   * Adds text or image watermark across pages with custom position presets, opacity, rotation, and page filters.
   */
  static async addWatermark(
    pdfBytes: Uint8Array,
    options: {
      type?: 'text' | 'image';
      text?: string;
      imageDataUrl?: string;
      fontSize?: number;
      imageWidth?: number;
      imageHeight?: number;
      opacity?: number;
      rotationAngle?: number;
      color?: { r: number; g: number; b: number };
      position?: 'center' | 'diagonal' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
      layer?: 'above' | 'behind';
      pageFilter?: 'all' | 'odd' | 'even' | number[] | string;
    } = {}
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (pages.length === 0) return pdfBytes;

    const type = options.type || (options.imageDataUrl ? 'image' : 'text');
    const opacity = options.opacity !== undefined ? options.opacity : 0.25;
    const position = options.position || 'diagonal';
    const angle = options.rotationAngle !== undefined ? options.rotationAngle : (position === 'diagonal' ? 45 : 0);

    // Parse target pages
    let targetPageIndices: number[] = [];
    const filter = options.pageFilter;
    if (!filter || filter === 'all') {
      targetPageIndices = Array.from({ length: pages.length }, (_, i) => i);
    } else if (filter === 'odd') {
      targetPageIndices = Array.from({ length: pages.length }, (_, i) => i).filter((i) => (i + 1) % 2 !== 0);
    } else if (filter === 'even') {
      targetPageIndices = Array.from({ length: pages.length }, (_, i) => i).filter((i) => (i + 1) % 2 === 0);
    } else if (Array.isArray(filter)) {
      targetPageIndices = filter.filter((i) => i >= 0 && i < pages.length);
    } else if (typeof filter === 'string') {
      const set = new Set<number>();
      const parts = filter.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [sStr, eStr] = part.split('-');
          const s = parseInt(sStr, 10);
          const e = parseInt(eStr, 10);
          if (!isNaN(s) && !isNaN(e)) {
            const start = Math.max(1, Math.min(s, e));
            const end = Math.min(pages.length, Math.max(s, e));
            for (let p = start; p <= end; p++) set.add(p - 1);
          }
        } else {
          const p = parseInt(part, 10);
          if (!isNaN(p) && p >= 1 && p <= pages.length) set.add(p - 1);
        }
      }
      targetPageIndices = Array.from(set).sort((a, b) => a - b);
    }
    if (targetPageIndices.length === 0) {
      targetPageIndices = Array.from({ length: pages.length }, (_, i) => i);
    }

    if (type === 'image' && options.imageDataUrl) {
      let embeddedImg;
      if (options.imageDataUrl.startsWith('data:image/png')) {
        embeddedImg = await pdfDoc.embedPng(options.imageDataUrl);
      } else {
        embeddedImg = await pdfDoc.embedJpg(options.imageDataUrl);
      }

      const imgDims = embeddedImg.scale(1);
      const targetW = options.imageWidth || 200;
      const targetH = options.imageHeight || (targetW * (imgDims.height / imgDims.width));

      for (const idx of targetPageIndices) {
        const page = pages[idx];
        const { width: pW, height: pH } = page.getSize();

        const getCoords = (pos: string) => {
          if (pos === 'top-left') return [{ x: 40, y: pH - targetH - 40 }];
          if (pos === 'top-right') return [{ x: pW - targetW - 40, y: pH - targetH - 40 }];
          if (pos === 'bottom-left') return [{ x: 40, y: 40 }];
          if (pos === 'bottom-right') return [{ x: pW - targetW - 40, y: 40 }];
          if (pos === 'tile') {
            const pts = [];
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                pts.push({
                  x: (pW / 3) * c + (pW / 6) - (targetW / 2),
                  y: (pH / 3) * r + (pH / 6) - (targetH / 2),
                });
              }
            }
            return pts;
          }
          return [{ x: (pW - targetW) / 2, y: (pH - targetH) / 2 }];
        };

        const coords = getCoords(position);
        for (const pt of coords) {
          page.drawImage(embeddedImg, {
            x: pt.x,
            y: pt.y,
            width: targetW,
            height: targetH,
            opacity,
            rotate: degrees(angle),
          });
        }
      }
    } else {
      // Text Watermark
      const text = options.text || 'CONFIDENTIAL';
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = options.fontSize || 48;
      const color = options.color
        ? rgb(options.color.r, options.color.g, options.color.b)
        : rgb(0.8, 0.1, 0.1);

      const textW = font.widthOfTextAtSize(text, fontSize);
      const textH = font.heightAtSize(fontSize);

      for (const idx of targetPageIndices) {
        const page = pages[idx];
        const { width: pW, height: pH } = page.getSize();

        const getCoords = (pos: string) => {
          if (pos === 'top-left') return [{ x: 40, y: pH - textH - 40 }];
          if (pos === 'top-right') return [{ x: pW - textW - 40, y: pH - textH - 40 }];
          if (pos === 'bottom-left') return [{ x: 40, y: 40 }];
          if (pos === 'bottom-right') return [{ x: pW - textW - 40, y: 40 }];
          if (pos === 'tile') {
            const pts = [];
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                pts.push({
                  x: (pW / 3) * c + (pW / 6) - (textW / 2),
                  y: (pH / 3) * r + (pH / 6) - (textH / 2),
                });
              }
            }
            return pts;
          }
          return [{ x: (pW - textW) / 2, y: (pH - textH) / 2 }];
        };

        const coords = getCoords(position);
        for (const pt of coords) {
          page.drawText(text, {
            x: pt.x,
            y: pt.y,
            size: fontSize,
            font,
            color,
            opacity,
            rotate: degrees(angle),
          });
        }
      }
    }

    return await pdfDoc.save();
  }

  /**
   * Adds text watermark across pages (compatibility alias).
   */
  static async addTextWatermark(
    pdfBytes: Uint8Array,
    text: string,
    options: {
      fontSize?: number;
      opacity?: number;
      rotationAngle?: number;
      color?: { r: number; g: number; b: number };
      position?: 'center' | 'diagonal' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
      pageFilter?: 'all' | 'odd' | 'even' | number[] | string;
    } = {}
  ): Promise<Uint8Array> {
    return await this.addWatermark(pdfBytes, {
      type: 'text',
      text,
      ...options,
    });
  }

  /**
   * Converts a list of image data URLs into a PDF.
   */
  static async imagesToPdf(
    images: { dataUrl: string; width: number; height: number }[],
    options: {
      pageSize?: 'A4' | 'LETTER' | 'AUTO';
      orientation?: 'portrait' | 'landscape';
      margin?: number;
    } = {}
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const margin = options.margin !== undefined ? options.margin : 20;

    for (const imgItem of images) {
      let imageEmbed;
      if (imgItem.dataUrl.startsWith('data:image/png')) {
        imageEmbed = await pdfDoc.embedPng(imgItem.dataUrl);
      } else {
        imageEmbed = await pdfDoc.embedJpg(imgItem.dataUrl);
      }

      let pageWidth = imgItem.width;
      let pageHeight = imgItem.height;

      if (options.pageSize === 'A4') {
        pageWidth = 595.28;
        pageHeight = 841.89;
      } else if (options.pageSize === 'LETTER') {
        pageWidth = 612.0;
        pageHeight = 792.0;
      }

      if (options.pageSize && options.orientation === 'landscape' && pageWidth < pageHeight) {
        const tmp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = tmp;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Calculate fit
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const scale = Math.min(maxWidth / imageEmbed.width, maxHeight / imageEmbed.height, 1);

      const renderWidth = imageEmbed.width * scale;
      const renderHeight = imageEmbed.height * scale;
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      page.drawImage(imageEmbed, {
        x,
        y,
        width: renderWidth,
        height: renderHeight,
      });
    }

    return await pdfDoc.save();
  }
}
