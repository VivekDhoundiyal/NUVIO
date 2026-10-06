import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CoordinateEngine } from '../engines/pdf/coordinateEngine';
import { TextObjectModel } from '../engines/pdf/textObjectModel';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import type { AnnotationObject, EditableTextSpan } from '../types/document';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createBaseTestPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = pdfDoc.addPage([600, 800]);
  page1.drawText('Invoice Number 1042', {
    x: 50,
    y: 750,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  page1.drawText('Customer Name: ACME Corp', {
    x: 50,
    y: 700,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Page 2
  const page2 = pdfDoc.addPage([600, 800]);
  page2.drawText('Terms and Conditions', {
    x: 50,
    y: 750,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  return await pdfDoc.save();
}

describe('Advanced PDF Editor Engine — Fidelity, Precision & Transforms', () => {
  it('1. Byte-level untouched document preservation: returns identical bytes when unmodified', async () => {
    const originalBytes = await createBaseTestPdf();
    const resultBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], {});

    expect(resultBytes).toBe(originalBytes);
    expect(resultBytes.length).toBe(originalBytes.length);
  });

  it('2. Coordinate Engine: exact bidirectional transform invariance across zoom levels (50% to 400%)', () => {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const testZooms = [0.5, 1.0, 1.5, 2.0, 4.0];

    for (const zoom of testZooms) {
      const origPdfPoint = { x: 120.5, y: 340.8 };

      // PDF -> Screen
      const screenPoint = CoordinateEngine.pdfPointToScreen(
        origPdfPoint.x,
        origPdfPoint.y,
        pageWidth,
        pageHeight,
        zoom,
        0
      );

      // Screen -> PDF
      const roundTripPdf = CoordinateEngine.screenPointToPdf(
        screenPoint.x,
        screenPoint.y,
        pageWidth,
        pageHeight,
        zoom,
        0
      );

      expect(roundTripPdf.x).toBeCloseTo(origPdfPoint.x, 3);
      expect(roundTripPdf.y).toBeCloseTo(origPdfPoint.y, 3);
    }
  });

  it('3. Coordinate Engine: rectangle transformations across 0, 90, 180, 270 degree page rotations', () => {
    const pageWidth = 600;
    const pageHeight = 800;
    const zoom = 1.25;
    const rotations = [0, 90, 180, 270];

    for (const rot of rotations) {
      const origRect = { x: 50, y: 100, width: 200, height: 40 };

      const screenRect = CoordinateEngine.pdfRectToScreen(
        origRect,
        pageWidth,
        pageHeight,
        zoom,
        rot
      );

      expect(screenRect.width).toBeGreaterThan(0);
      expect(screenRect.height).toBeGreaterThan(0);

      const roundTrip = CoordinateEngine.screenRectToPdf(
        screenRect,
        pageWidth,
        pageHeight,
        zoom,
        rot
      );

      expect(roundTrip.width).toBeCloseTo(origRect.width, 2);
      expect(roundTrip.height).toBeCloseTo(origRect.height, 2);
    }
  });

  it('4. Coordinate Engine: rotation angle snapping to 15-degree steps', () => {
    expect(CoordinateEngine.snapAngle(14, 15)).toBe(15);
    expect(CoordinateEngine.snapAngle(16, 15)).toBe(15);
    expect(CoordinateEngine.snapAngle(44, 15)).toBe(45);
    expect(CoordinateEngine.snapAngle(91, 15)).toBe(90);
    expect(CoordinateEngine.snapAngle(359, 15)).toBe(0);
  });

  it('5. Precision Text Object Model: tokenizes text spans into discrete words with exact geometry', () => {
    const span: EditableTextSpan = {
      id: 'test-span-1',
      pageIndex: 0,
      originalText: 'Invoice Number 1042',
      currentText: 'Invoice Number 1042',
      x: 50,
      y: 50, // screen y
      width: 180,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#1e293b',
      rgbColor: { r: 0.12, g: 0.16, b: 0.23 },
      transformMatrix: [16, 0, 0, 16, 50, 750],
      baseline: 750,
      isModified: false,
    };

    const words = TextObjectModel.tokenizeSpanIntoWords(span, 800);
    expect(words).toHaveLength(3);
    expect(words[0].text).toBe('Invoice');
    expect(words[1].text).toBe('Number');
    expect(words[2].text).toBe('1042');

    // Geometry validation
    expect(words[0].x).toBe(50);
    expect(words[1].x).toBeGreaterThan(words[0].x + words[0].width - 1);
    expect(words[2].x).toBeGreaterThan(words[1].x + words[1].width - 1);
    expect(words[0].baseline).toBe(750);
    expect(words[0].isModified).toBe(false);
  });

  it('6. Word-Level Micro-Delta Isolation: modifies only targeted word while sibling words remain untouched', () => {
    const span: EditableTextSpan = {
      id: 'test-span-2',
      pageIndex: 0,
      originalText: 'Invoice Number 1042',
      currentText: 'Invoice Number 1042',
      x: 50,
      y: 50,
      width: 180,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#1e293b',
      rgbColor: { r: 0.12, g: 0.16, b: 0.23 },
      transformMatrix: [16, 0, 0, 16, 50, 750],
      baseline: 750,
      isModified: false,
    };

    span.words = TextObjectModel.tokenizeSpanIntoWords(span, 800);
    expect(span.words).toHaveLength(3);

    // Modify ONLY word 0 ("Invoice" -> "Receipt")
    const updatedSpan = TextObjectModel.updateWordInSpan(span, span.words[0].id, 'Receipt');

    expect(updatedSpan.isModified).toBe(true);
    expect(updatedSpan.currentText).toBe('Receipt Number 1042');

    // Crucial requirement: only word 0 is modified, words 1 and 2 are UNTOUCHED
    expect(updatedSpan.words![0].text).toBe('Receipt');
    expect(updatedSpan.words![0].isModified).toBe(true);
    expect(updatedSpan.words![1].text).toBe('Number');
    expect(updatedSpan.words![1].isModified).toBe(false);
    expect(updatedSpan.words![2].text).toBe('1042');
    expect(updatedSpan.words![2].isModified).toBe(false);
  });

  it('7. Precision Hit-Testing: resolves exact word and character clicked', () => {
    const span: EditableTextSpan = {
      id: 'test-span-hit',
      pageIndex: 0,
      originalText: 'Alpha Beta Gamma',
      currentText: 'Alpha Beta Gamma',
      x: 100,
      y: 200,
      width: 150,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#000000',
      rgbColor: { r: 0, g: 0, b: 0 },
      transformMatrix: [16, 0, 0, 16, 100, 600],
      baseline: 600,
      isModified: false,
    };

    const words = TextObjectModel.tokenizeSpanIntoWords(span, 800);
    const zoom = 1.0;

    // Click on "Alpha"
    const hit1 = TextObjectModel.hitTestWord(words, words[0].x + 5, words[0].y + 5, zoom);
    expect(hit1).not.toBeNull();
    expect(hit1!.word.text).toBe('Alpha');

    // Click on "Gamma"
    const hit2 = TextObjectModel.hitTestWord(words, words[2].x + 5, words[2].y + 5, zoom);
    expect(hit2).not.toBeNull();
    expect(hit2!.word.text).toBe('Gamma');

    // Click far outside
    const hitMiss = TextObjectModel.hitTestWord(words, 900, 900, zoom);
    expect(hitMiss).toBeNull();
  });

  it('8. Round-Trip Export Fidelity: loads PDF, edits word, exports, and re-extracts cleanly', async () => {
    const baseBytes = await createBaseTestPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    expect(textSpans.length).toBeGreaterThan(0);
    const invoiceSpan = textSpans.find((s) => s.originalText.includes('Invoice'));
    expect(invoiceSpan).toBeDefined();
    expect(invoiceSpan!.words).toBeDefined();
    expect(invoiceSpan!.words!.length).toBeGreaterThan(0);

    // Edit word 0
    const targetWord = invoiceSpan!.words![0];
    const modifiedSpan = TextObjectModel.updateWordInSpan(invoiceSpan!, targetWord.id, 'STATEMENT');

    const editedSpansByPage = {
      0: [modifiedSpan],
    };

    // Burn edits
    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      editedSpansByPage
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(0);

    // Reload exported PDF in PDF.js to verify round-trip integrity
    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    expect(reloadedDoc.numPages).toBe(2);

    const page1 = await reloadedDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const allStrings = textContent.items.map((i: any) => i.str).join(' ');

    expect(allStrings).toContain('STATEMENT');
  });

  it('9. Annotations Pipeline: signatures, stamps, watermarks, shapes, and cross-page transfers', async () => {
    const baseBytes = await createBaseTestPdf();

    const annotations: AnnotationObject[] = [
      // 1. Signature
      {
        id: 'sig-1',
        type: 'signature',
        pageIndex: 0,
        x: 100,
        y: 600,
        width: 150,
        height: 60,
        imageDataUrl: SAMPLE_PNG_DATA_URL,
        createdAt: Date.now(),
      },
      // 2. Stamp
      {
        id: 'stamp-1',
        type: 'stamp',
        pageIndex: 0,
        x: 300,
        y: 600,
        width: 120,
        height: 50,
        stampText: 'APPROVED',
        strokeColor: '#16a34a',
        rotation: -10,
        createdAt: Date.now(),
      },
      // 3. Watermark
      {
        id: 'wm-1',
        type: 'watermark',
        pageIndex: 1,
        x: 150,
        y: 400,
        width: 300,
        height: 100,
        text: 'CONFIDENTIAL',
        fontSize: 36,
        textColor: '#dc2626',
        opacity: 0.2,
        rotation: -45,
        createdAt: Date.now(),
      },
      // 4. Shape (Rectangle)
      {
        id: 'rect-1',
        type: 'shape',
        shapeType: 'rectangle',
        pageIndex: 1,
        x: 50,
        y: 500,
        width: 200,
        height: 100,
        strokeColor: '#2563eb',
        fillColor: '#eff6ff',
        strokeWidth: 2,
        createdAt: Date.now(),
      },
    ];

    const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      annotations,
      {}
    );

    expect(burnedBytes).toBeInstanceOf(Uint8Array);
    const reloadedDoc = await PdfEngine.loadPdfJsDoc(burnedBytes);
    expect(reloadedDoc.numPages).toBe(2);
  });
});
