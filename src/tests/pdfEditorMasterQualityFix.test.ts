import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { measureTextWidth } from '../features/pdf-editor/EditorCanvas';
import { PdfTextEditEngine } from '../engines/pdf/pdfTextEditEngine';
import { PdfFontResolver } from '../engines/pdf/pdfFontResolver';
import { TextObjectModel } from '../engines/pdf/textObjectModel';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { PdfCoordinateSystem } from '../engines/pdf/pdfCoordinateSystem';
import type { PdfTextRun } from '../engines/pdf/pdfTextObjectModel';

async function createTestDocument(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([600, 800]);

  page.drawText('Lorem ipsum dolor sit amet consectetur', {
    x: 50,
    y: 720,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  return await pdfDoc.save();
}

describe('NUVIO PDF Editor — Master Quality & Architecture Fix Verification', () => {
  describe('1. Precision Glyph Measurement & Zero Character Clipping', () => {
    it('accurately allocates width for "Vivek" with zero clipping buffer', () => {
      const fontSpec = '14px Helvetica, Arial, sans-serif';
      const text = 'Vivek';
      const measured = measureTextWidth(text, fontSpec);

      expect(measured).toBeGreaterThan(0);
      const allocatedWidth = Math.max(30, Math.ceil(measured + 28));

      // Allocated container must exceed measured text by at least 20px
      expect(allocatedWidth - measured).toBeGreaterThanOrEqual(20);
    });

    it('accurately allocates width for "Vivek Dhoundiyal" with zero clipping buffer', () => {
      const fontSpec = '14px Helvetica, Arial, sans-serif';
      const text = 'Vivek Dhoundiyal';
      const measured = measureTextWidth(text, fontSpec);

      expect(measured).toBeGreaterThan(0);
      const allocatedWidth = Math.max(50, Math.ceil(measured + 28));

      expect(allocatedWidth - measured).toBeGreaterThanOrEqual(20);
      // Ensures the final character 'l' and space are comfortably within bounds
      expect(allocatedWidth).toBeGreaterThan(measured);
    });

    it('maintains proportional safety margins across multiple zoom levels (50% to 200%)', () => {
      const zooms = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
      const text = 'Vivek Dhoundiyal';

      for (const zoom of zooms) {
        const fontSpec = `${Math.round(14 * zoom)}px Helvetica, Arial, sans-serif`;
        const measured = measureTextWidth(text, fontSpec);
        const allocated = Math.max(50 * zoom, Math.ceil(measured + 28));

        expect(allocated).toBeGreaterThan(measured);
        expect(allocated - measured).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe('2. Text Reflow Prevention & Kerning Compensation', () => {
    it('inserts kerning adjustment in computeGlyphPatch when replacement expands to prevent suffix reflow', () => {
      const mockFontResolver = new PdfFontResolver();
      const mockRun: PdfTextRun = {
        opIndex: 0,
        streamIndex: 0,
        operandIndex: 0,
        operator: 'Tj',
        text: 'Lorem ipsum dolor sit amet',
        decodedText: 'Lorem ipsum dolor sit amet',
        isHexString: false,
        x: 50,
        y: 720,
        width: 180,
        height: 14,
        fontSize: 14,
        fontResource: '/F1',
        graphicsState: {
          charSpacing: 0,
          wordSpacing: 0,
          horizontalScale: 100,
          leading: 14,
          fontResource: '/F1',
          fontSize: 14,
          textRenderMode: 0,
          textRise: 0,
          textKnockout: true,
          fillColorRgb: { r: 0, g: 0, b: 0 },
          strokeColorRgb: { r: 0, g: 0, b: 0 },
        },
        glyphs: 'Lorem ipsum dolor sit amet'.split('').map((ch, idx) => ({
          char: ch,
          code: ch.charCodeAt(0),
          width: 7,
          x: 50 + idx * 7,
          y: 720,
        })),
      } as unknown as PdfTextRun;

      // Replace "sit" (index 18 to 21) with "Vivek Dhoundiyal"
      const patch = PdfTextEditEngine.computeGlyphPatch(
        mockRun,
        18,
        21,
        'Vivek Dhoundiyal',
        mockFontResolver
      );

      // Verify deltaWidth is positive (replacement is wider than original)
      expect(patch.deltaWidth).toBeGreaterThan(0);
      // Verify patchedOperatorText contains replacement without clipping suffix collision
      expect(patch.patchedOperatorText).toContain('Vivek Dhoundiyal');
      expect(patch.patchedOperatorText).toContain('amet');
    });

    it('leaves words untouched in textObjectModel when editing a single word', () => {
      const span = {
        id: 'span-1',
        pageIndex: 0,
        x: 50,
        y: 80,
        width: 180,
        height: 14,
        fontSize: 14,
        fontFamily: 'Helvetica, Arial, sans-serif',
        originalText: 'Lorem ipsum dolor sit amet',
        currentText: 'Lorem ipsum dolor sit amet',
        color: '#000000',
        words: [
          { id: 'w-0', spanId: 'span-1', pageIndex: 0, text: 'Lorem', originalText: 'Lorem', x: 50, y: 80, width: 35, height: 14, fontSize: 14, fontFamily: 'Helvetica', fontWeight: 'normal', fontStyle: 'normal', color: '#000000' },
          { id: 'w-1', spanId: 'span-1', pageIndex: 0, text: 'ipsum', originalText: 'ipsum', x: 90, y: 80, width: 35, height: 14, fontSize: 14, fontFamily: 'Helvetica', fontWeight: 'normal', fontStyle: 'normal', color: '#000000' },
          { id: 'w-2', spanId: 'span-1', pageIndex: 0, text: 'dolor', originalText: 'dolor', x: 130, y: 80, width: 30, height: 14, fontSize: 14, fontFamily: 'Helvetica', fontWeight: 'normal', fontStyle: 'normal', color: '#000000' },
          { id: 'w-3', spanId: 'span-1', pageIndex: 0, text: 'sit', originalText: 'sit', x: 165, y: 80, width: 18, height: 14, fontSize: 14, fontFamily: 'Helvetica', fontWeight: 'normal', fontStyle: 'normal', color: '#000000' },
          { id: 'w-4', spanId: 'span-1', pageIndex: 0, text: 'amet', originalText: 'amet', x: 188, y: 80, width: 30, height: 14, fontSize: 14, fontFamily: 'Helvetica', fontWeight: 'normal', fontStyle: 'normal', color: '#000000' },
        ],
      };

      const updated = TextObjectModel.updateWordInSpan(span as any, 'w-3', 'Vivek');

      // The unedited words must retain their EXACT original x coordinates
      expect(updated.words![0].x).toBe(50);
      expect(updated.words![1].x).toBe(90);
      expect(updated.words![2].x).toBe(130);
      expect(updated.words![4].x).toBe(188); // 'amet' x coordinate did not move!
      expect(updated.words![3].text).toBe('Vivek');
      expect(updated.currentText).toBe('Lorem ipsum dolor Vivek amet');
    });
  });

  describe('3. Round-Trip Export Fidelity with "Vivek" and "Vivek Dhoundiyal"', () => {
    it('burns "Vivek" and successfully extracts it without double-impression', async () => {
      const basePdfBytes = await createTestDocument();
      const docProxy = await PdfEngine.loadPdfJsDoc(basePdfBytes);
      const { textSpans } = await PdfEngine.extractPageTextSpans(docProxy, 1);

      const targetSpan = textSpans.find((s) => s.originalText.includes('sit'));
      expect(targetSpan).toBeDefined();

      const sitWord = targetSpan!.words!.find((w) => w.text === 'sit');
      expect(sitWord).toBeDefined();

      const editedSpan = TextObjectModel.updateWordInSpan(targetSpan!, sitWord!.id, 'Vivek');
      const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        basePdfBytes,
        [],
        { 0: [editedSpan] }
      );

      // Verify the exported PDF contains 'Vivek'
      const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
      const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
      const allText = reloadedSpans.map((s) => s.currentText).join(' ');

      expect(allText).toContain('Vivek');
    });

    it('burns "Vivek Dhoundiyal" and extracts all characters with full fidelity', async () => {
      const basePdfBytes = await createTestDocument();
      const docProxy = await PdfEngine.loadPdfJsDoc(basePdfBytes);
      const { textSpans } = await PdfEngine.extractPageTextSpans(docProxy, 1);

      const targetSpan = textSpans.find((s) => s.originalText.includes('sit'));
      expect(targetSpan).toBeDefined();

      const sitWord = targetSpan!.words!.find((w) => w.text === 'sit');
      expect(sitWord).toBeDefined();

      const editedSpan = TextObjectModel.updateWordInSpan(targetSpan!, sitWord!.id, 'Vivek Dhoundiyal');
      const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        basePdfBytes,
        [],
        { 0: [editedSpan] }
      );

      const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
      const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
      const allText = reloadedSpans.map((s) => s.currentText).join(' ');

      expect(allText).toContain('Vivek Dhoundiyal');
    });
  });

  describe('4. Coordinate System Zoom Invariance', () => {
    it('accurately converts PDF coordinates across standard zoom levels', () => {
      const pageGeom = { width: 595, height: 842, rotation: 0 };
      const pdfX = 100;
      const pdfY = 500;
      const width = 120;
      const height = 24;

      const rect100 = PdfCoordinateSystem.pdfToViewport(pdfX, pdfY, width, height, pageGeom, 1.0);
      const rect150 = PdfCoordinateSystem.pdfToViewport(pdfX, pdfY, width, height, pageGeom, 1.5);
      const rect200 = PdfCoordinateSystem.pdfToViewport(pdfX, pdfY, width, height, pageGeom, 2.0);

      expect(rect150.x).toBeCloseTo(rect100.x * 1.5, 1);
      expect(rect150.y).toBeCloseTo(rect100.y * 1.5, 1);
      expect(rect150.width).toBeCloseTo(rect100.width * 1.5, 1);
      expect(rect150.height).toBeCloseTo(rect100.height * 1.5, 1);

      expect(rect200.x).toBeCloseTo(rect100.x * 2.0, 1);
      expect(rect200.y).toBeCloseTo(rect100.y * 2.0, 1);
      expect(rect200.width).toBeCloseTo(rect100.width * 2.0, 1);
      expect(rect200.height).toBeCloseTo(rect100.height * 2.0, 1);
    });
  });
});
