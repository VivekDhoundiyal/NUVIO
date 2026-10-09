import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PDFTextMetrics } from '../engines/pdf/pdfTextMetrics';
import { TextObjectModel } from '../engines/pdf/textObjectModel';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import type { EditableTextSpan } from '../types/document';

describe('NUVIO PDF Editor — Advanced Text Fidelity & Font Preservation Engine', () => {
  describe('1. K-Specific Diagnostic & Zero-Clipping Suite', () => {
    const kTestStrings = [
      'k',
      'K',
      'kk',
      'ak',
      'ka',
      'ek',
      'ke',
      'Vivek',
      'VIVEK',
      'Vivek Dhoundiyal',
      'Vivek Kumar',
      'Dhoundiyal',
      'NUVIO',
      'PDF',
      'Book',
      'Work',
      'Keyboard',
      'kkkkkkkkkkkk',
      'KKKKKKKKKK',
    ];

    for (const str of kTestStrings) {
      it(`calculates complete glyph advances and bounds for "${str}" with zero trailing clipping`, () => {
        const measurement = PDFTextMetrics.measureText(str, {
          fontSize: 14,
          fontFamily: 'Helvetica, Arial, sans-serif',
        });

        // 1. Every character has a positive glyph advance
        expect(measurement.glyphAdvances.length).toBe(str.length);
        for (let i = 0; i < str.length; i++) {
          expect(measurement.glyphAdvances[i]).toBeGreaterThan(0);
        }

        // 2. Total advance width exceeds zero and accounts for all characters
        expect(measurement.advanceWidth).toBeGreaterThan(0);
        expect(measurement.visualWidth).toBeGreaterThanOrEqual(measurement.advanceWidth);

        // 3. Recommended input container width provides safe boundary for trailing glyphs
        expect(measurement.recommendedInputWidthPx).toBeGreaterThan(measurement.visualWidthPx);
        expect(measurement.recommendedInputWidthPx - measurement.visualWidthPx).toBeGreaterThanOrEqual(16);

        // 4. Character bounds cover the entire string without truncation
        const lastBound = measurement.charBounds[measurement.charBounds.length - 1];
        expect(lastBound.char).toBe(str[str.length - 1]);
        expect(lastBound.x + lastBound.width).toBeCloseTo(measurement.advanceWidth, 1);
      });
    }

    it('ensures trailing "k" in "Vivek" and "Vivek Dhoundiyal" allocates full visual bounding box', () => {
      const vivek = PDFTextMetrics.measureText('Vivek', { fontSize: 12 });
      const vive = PDFTextMetrics.measureText('Vive', { fontSize: 12 });

      // Vivek must be strictly wider than Vive by at least the advance width of 'k'
      expect(vivek.advanceWidth).toBeGreaterThan(vive.advanceWidth);
      const kAdvance = PDFTextMetrics.getGlyphAdvance('k', 12, 'Helvetica');
      expect(vivek.advanceWidth - vive.advanceWidth).toBeCloseTo(kAdvance, 1);

      // Trailing bounds for 'k' must be intact
      const trailingBound = vivek.charBounds[4];
      expect(trailingBound.char).toBe('k');
      expect(trailingBound.width).toBeCloseTo(kAdvance, 1);
    });

    it('computes input bounds with generous right padding across zoom levels (50% to 200%)', () => {
      const zooms = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
      for (const zoom of zooms) {
        const bounds = PDFTextMetrics.computeInputBounds('Vivek', { fontSize: 14 }, zoom, 28);
        const measurement = PDFTextMetrics.measureText('Vivek', { fontSize: 14 }, zoom);

        expect(bounds.widthPx).toBeGreaterThan(measurement.visualWidthPx);
        expect(bounds.widthPx - measurement.visualWidthPx).toBeGreaterThanOrEqual(20);
        expect(bounds.heightPx).toBeGreaterThan(measurement.heightPx);
      }
    });
  });

  describe('2. Format / Style Preservation (Mode A Immutable Original Style)', () => {
    it('preserves original font, size, weight, color, and baseline when editing text content', () => {
      const originalSpan: EditableTextSpan = {
        id: 'span-rich-1',
        pageIndex: 0,
        x: 100,
        y: 200,
        pdfX: 100,
        pdfY: 642,
        width: 140,
        height: 18,
        fontSize: 16.5,
        originalFontSize: 16.5,
        fontFamily: 'Times New Roman, Times, serif',
        originalFontFamily: 'Times New Roman, Times, serif',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#dc2626',
        originalColor: '#dc2626',
        originalText: 'Important Notice Heading',
        currentText: 'Important Notice Heading',
        baseline: 642,
        isModified: false,
        dirty: false,
        source: 'pdf-existing',
        originalStyle: {
          fontFamily: 'Times New Roman, Times, serif',
          fontSize: 16.5,
          fontWeight: 'bold',
          fontStyle: 'italic',
          color: '#dc2626',
          underline: false,
          strikethrough: false,
        },
        currentStyle: {
          fontFamily: 'Times New Roman, Times, serif',
          fontSize: 16.5,
          fontWeight: 'bold',
          fontStyle: 'italic',
          color: '#dc2626',
          underline: false,
          strikethrough: false,
        },
        originalGeometry: {
          x: 100,
          y: 200,
          pdfX: 100,
          pdfY: 642,
          width: 140,
          height: 18,
          baseline: 642,
        },
      };

      const words = TextObjectModel.tokenizeSpanIntoWords(originalSpan, 842);
      originalSpan.words = words;

      // Edit the word "Notice" (index 1) to "Vivek"
      const noticeWord = words.find((w) => w.text === 'Notice');
      expect(noticeWord).toBeDefined();

      const updatedSpan = TextObjectModel.updateWordInSpan(originalSpan, noticeWord!.id, 'Vivek');

      // 1. Content changed
      expect(updatedSpan.currentText).toBe('Important Vivek Heading');
      expect(updatedSpan.isModified).toBe(true);

      // 2. All formatting remains 100% UNTOUCHED
      expect(updatedSpan.fontFamily).toBe('Times New Roman, Times, serif');
      expect(updatedSpan.originalFontFamily).toBe('Times New Roman, Times, serif');
      expect(updatedSpan.fontSize).toBe(16.5);
      expect(updatedSpan.fontWeight).toBe('bold');
      expect(updatedSpan.fontStyle).toBe('italic');
      expect(updatedSpan.color).toBe('#dc2626');
      expect(updatedSpan.baseline).toBe(642);

      // 3. Child words inherit untouched style
      const updatedWord = updatedSpan.words!.find((w) => w.id === noticeWord!.id);
      expect(updatedWord!.fontFamily).toBe('Times New Roman, Times, serif');
      expect(updatedWord!.fontSize).toBe(16.5);
      expect(updatedWord!.fontWeight).toBe('bold');
      expect(updatedWord!.fontStyle).toBe('italic');
      expect(updatedWord!.color).toBe('#dc2626');
    });

    it('successfully reverts span back to original text and style via revertSpan', () => {
      const span: EditableTextSpan = {
        id: 'span-rev-1',
        pageIndex: 0,
        x: 50,
        y: 100,
        pdfX: 50,
        pdfY: 742,
        width: 100,
        height: 14,
        fontSize: 14,
        fontFamily: 'Georgia, serif',
        originalFontFamily: 'Georgia, serif',
        color: '#2563eb',
        originalColor: '#2563eb',
        originalText: 'Original Text',
        currentText: 'Original Text',
        baseline: 742,
        isModified: false,
        source: 'pdf-existing',
        originalStyle: {
          fontFamily: 'Georgia, serif',
          fontSize: 14,
          color: '#2563eb',
          fontWeight: 'normal',
          fontStyle: 'normal',
          underline: false,
          strikethrough: false,
        },
        originalGeometry: {
          x: 50,
          y: 100,
          pdfX: 50,
          pdfY: 742,
          width: 100,
          height: 14,
          baseline: 742,
        },
      };

      const words = TextObjectModel.tokenizeSpanIntoWords(span, 842);
      span.words = words;

      // Mutate
      const modified = TextObjectModel.updateWordInSpan(span, words[0].id, 'Edited');
      expect(modified.isModified).toBe(true);
      expect(modified.currentText).toBe('Edited Text');

      // Revert
      const reverted = TextObjectModel.revertSpan(modified);
      expect(reverted.isModified).toBe(false);
      expect(reverted.currentText).toBe('Original Text');
      expect(reverted.fontFamily).toBe('Georgia, serif');
      expect(reverted.color).toBe('#2563eb');
    });
  });

  describe('3. No Reflow Regression Gate (WORD A / WORD B / WORD C)', () => {
    it('guarantees that replacing WORD B leaves WORD A and WORD C coordinates 100% unchanged', () => {
      const span: EditableTextSpan = {
        id: 'span-reflow-1',
        pageIndex: 0,
        x: 50,
        y: 300,
        pdfX: 50,
        pdfY: 542,
        width: 250,
        height: 14,
        fontSize: 14,
        fontFamily: 'Helvetica, Arial, sans-serif',
        originalText: 'WORDA WORDB WORDC',
        currentText: 'WORDA WORDB WORDC',
        baseline: 542,
        isModified: false,
        words: [
          {
            id: 'w-a',
            spanId: 'span-reflow-1',
            pageIndex: 0,
            text: 'WORDA',
            originalText: 'WORDA',
            x: 50,
            y: 300,
            pdfX: 50,
            pdfY: 542,
            width: 50,
            height: 14,
            baseline: 542,
            fontSize: 14,
            fontFamily: 'Helvetica',
            color: '#000000',
            rgbColor: { r: 0, g: 0, b: 0 },
            isModified: false,
          },
          {
            id: 'w-b',
            spanId: 'span-reflow-1',
            pageIndex: 0,
            text: 'WORDB',
            originalText: 'WORDB',
            x: 120,
            y: 300,
            pdfX: 120,
            pdfY: 542,
            width: 50,
            height: 14,
            baseline: 542,
            fontSize: 14,
            fontFamily: 'Helvetica',
            color: '#000000',
            rgbColor: { r: 0, g: 0, b: 0 },
            isModified: false,
          },
          {
            id: 'w-c',
            spanId: 'span-reflow-1',
            pageIndex: 0,
            text: 'WORDC',
            originalText: 'WORDC',
            x: 200,
            y: 300,
            pdfX: 200,
            pdfY: 542,
            width: 50,
            height: 14,
            baseline: 542,
            fontSize: 14,
            fontFamily: 'Helvetica',
            color: '#000000',
            rgbColor: { r: 0, g: 0, b: 0 },
            isModified: false,
          },
        ],
      };

      // Replace WORDB with "Vivek Dhoundiyal"
      const updated = TextObjectModel.updateWordInSpan(span, 'w-b', 'Vivek Dhoundiyal');

      // VERIFY:
      // 1. WORDA position is 100% UNCHANGED
      expect(updated.words![0].x).toBe(50);
      expect(updated.words![0].pdfX).toBe(50);
      expect(updated.words![0].y).toBe(300);
      expect(updated.words![0].width).toBe(50);

      // 2. WORDC position is 100% UNCHANGED (zero HTML reflow!)
      expect(updated.words![2].x).toBe(200);
      expect(updated.words![2].pdfX).toBe(200);
      expect(updated.words![2].y).toBe(300);
      expect(updated.words![2].width).toBe(50);

      // 3. Only WORDB changed text and width
      expect(updated.words![1].text).toBe('Vivek Dhoundiyal');
      expect(updated.words![1].width).toBeGreaterThan(50);
    });
  });

  describe('4. Zoom Invariance & Coordinate Parity', () => {
    it('produces identical PDF user-space coordinates regardless of editor display zoom', () => {
      const pageGeom = { width: 612, height: 792, rotation: 0 };
      const pdfBaseline = 500;
      const fontSize = 14;

      const zooms = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

      for (const zoom of zooms) {
        // Convert baseline to viewport top
        const viewportTop = PDFTextMetrics.pdfBaselineToViewportTop(
          pdfBaseline,
          pageGeom.height,
          fontSize,
          zoom
        );

        // Convert back to PDF baseline
        const recoveredBaseline = PDFTextMetrics.viewportTopToPdfBaseline(
          viewportTop,
          pageGeom.height,
          fontSize,
          zoom
        );

        expect(recoveredBaseline).toBeCloseTo(pdfBaseline, 1);
      }
    });
  });

  describe('5. Round-Trip Export, Re-Open & "k" Visibility Verification', () => {
    it('edits text with "Vivek", exports PDF, re-opens, and extracts "Vivek" with letter "k" fully intact', async () => {
      // 1. Create a pristine vector PDF fixture
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const page = pdfDoc.addPage([600, 800]);

      page.drawText('The developer named John is coding.', {
        x: 60,
        y: 700,
        size: 14,
        font: helvetica,
        color: rgb(0, 0, 0),
      });

      const initialBytes = await pdfDoc.save();

      // 2. Load into PdfEngine and extract text spans
      const docProxy = await PdfEngine.loadPdfJsDoc(initialBytes);
      const { textSpans } = await PdfEngine.extractPageTextSpans(docProxy, 1);

      const targetSpan = textSpans.find((s) => s.originalText.includes('John'));
      expect(targetSpan).toBeDefined();

      const johnWord = targetSpan!.words!.find((w) => w.text === 'John');
      expect(johnWord).toBeDefined();

      // 3. Replace "John" with "Vivek"
      const editedSpan = TextObjectModel.updateWordInSpan(targetSpan!, johnWord!.id, 'Vivek');

      // 4. Burn edits into PDF binary
      const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        initialBytes,
        [],
        { 0: [editedSpan] }
      );

      // 5. Re-open exported PDF using PDF.js proxy
      const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
      const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
      const fullText = reloadedSpans.map((s) => s.currentText).join(' ');

      // 6. Verify "Vivek" is present with 'k'
      expect(fullText).toContain('Vivek');
      expect(fullText).not.toContain('Vive is'); // must not be clipped as Vive!
      expect(fullText).toContain('k');
    });
  });
});
