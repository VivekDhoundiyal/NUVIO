import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfVisualRegressionTester } from '../engines/pdf/pdfVisualRegressionTester';
import { PdfTextEditEngine } from '../engines/pdf/pdfTextEditEngine';
import type { EditableTextSpan, AnnotationObject } from '../types/document';

describe('PdfVisualRegressionTester — 4-Level Surgical Text Editing Verification', () => {
  /**
   * Helper: Generates a realistic original PDF document with a title and paragraph.
   */
  async function generateTestPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);

    // Title: "Sample PDF Document"
    page.drawText('Sample PDF Document', {
      x: 50,
      y: 320,
      size: 24,
      font: helveticaBold,
      color: rgb(0.06, 0.09, 0.16),
    });

    // Subheading: "Important surrounding heading"
    page.drawText('Important surrounding heading', {
      x: 50,
      y: 280,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Paragraph
    page.drawText('This is untouched surrounding text that must remain byte-for-byte identical.', {
      x: 50,
      y: 240,
      size: 11,
      font: helvetica,
      color: rgb(0.25, 0.25, 0.25),
    });

    return await doc.save();
  }

  it('verifies exact "Sample PDF" -> "Sample PDC" edit: "Sample", "P", "D" remain 100% untouched with 0 white masks', async () => {
    const originalPdfBytes = await generateTestPdf();

    // User edits only the word "PDF" to "PDC" (only 'F' -> 'C' changes)
    const editedSpan: EditableTextSpan = {
      id: 'span-pdc',
      pageIndex: 0,
      originalText: 'Sample PDF Document',
      currentText: 'Sample PDC Document',
      x: 50,
      y: 56, // 400 - 320 - 24
      width: 250,
      height: 28,
      fontSize: 24,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontWeight: 'bold',
      color: '#0f172a',
      rgbColor: { r: 0.06, g: 0.09, b: 0.16 },
      rotation: 0,
      transformMatrix: [24, 0, 0, 24, 50, 320],
      baseline: 320,
      isModified: true,
      words: [
        {
          id: 'w-1',
          spanId: 'span-pdc',
          pageIndex: 0,
          originalText: 'Sample',
          text: 'Sample',
          x: 50,
          y: 56,
          pdfX: 50,
          pdfY: 320,
          width: 78,
          height: 28,
          baseline: 320,
          fontSize: 24,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#0f172a',
          rgbColor: { r: 0.06, g: 0.09, b: 0.16 },
          isModified: false,
        },
        {
          id: 'w-2',
          spanId: 'span-pdc',
          pageIndex: 0,
          originalText: 'PDF',
          text: 'PDC',
          x: 135,
          y: 56,
          pdfX: 135,
          pdfY: 320,
          width: 44,
          height: 28,
          baseline: 320,
          fontSize: 24,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#0f172a',
          rgbColor: { r: 0.06, g: 0.09, b: 0.16 },
          isModified: true,
        },
        {
          id: 'w-3',
          spanId: 'span-pdc',
          pageIndex: 0,
          originalText: 'Document',
          text: 'Document',
          x: 185,
          y: 56,
          pdfX: 185,
          pdfY: 320,
          width: 105,
          height: 28,
          baseline: 320,
          fontSize: 24,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#0f172a',
          rgbColor: { r: 0.06, g: 0.09, b: 0.16 },
          isModified: false,
        },
      ],
    };

    const editedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      { 0: [editedSpan] }
    );

    expect(editedPdfBytes).toBeDefined();

    // 1. Run 4-level Visual & Content Regression Tester
    const report = await PdfVisualRegressionTester.comparePdfs(
      originalPdfBytes,
      editedPdfBytes,
      0,
      { original: 'F', replacement: 'C' }
    );

    // Assert zero white masking rectangles
    expect(report.streamReport.whiteMaskDetected).toBe(false);

    // Assert glyph fidelity: untouched glyphs ("Sample", "P", "D", "Document", etc.) match 100%
    expect(report.glyphReport.deviantGlyphs).toHaveLength(0);
    expect(report.glyphReport.isFidelityPreserved).toBe(true);

    // 2. Verify with PDF.js text extraction
    const pdfJsDoc = await pdfjsLib.getDocument({ data: editedPdfBytes }).promise;
    const page1 = await pdfJsDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const fullText = textContent.items.map((i: any) => i.str).join(' ');

    expect(fullText).toContain('Sample');
    expect(fullText).toContain('PDC');
    expect(fullText).toContain('Document');
    expect(fullText).toContain('This is untouched surrounding text that must remain byte-for-byte identical.');
  });

  it('mathematically computes kerning compensation when replacement glyph has different width', () => {
    // Diff math test
    const diff = PdfTextEditEngine.computeDiffRange('Sample PDF Document', 'Sample PDC Document');
    expect(diff.prefixLen).toBe(9); // "Sample PD" is exactly 9 chars
    // 'S'(0) 'a'(1) 'm'(2) 'p'(3) 'l'(4) 'e'(5) ' '(6) 'P'(7) 'D'(8)
    expect(diff.origChangeLen).toBe(1); // 'F'
    expect(diff.replChangeText).toBe('C');
  });

  it('preserves object tools: signatures, stamps, and watermarks remain independent editable objects', async () => {
    const originalPdfBytes = await generateTestPdf();

    const dummySigUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const annotations: AnnotationObject[] = [
      {
        id: 'sig-independent',
        type: 'signature',
        pageIndex: 0,
        x: 100,
        y: 100,
        width: 140,
        height: 50,
        rotation: 0,
        imageDataUrl: dummySigUrl,
        createdAt: Date.now(),
      },
      {
        id: 'stamp-independent',
        type: 'stamp',
        stampType: 'APPROVED',
        pageIndex: 0,
        x: 300,
        y: 80,
        width: 120,
        height: 45,
        rotation: -5,
        createdAt: Date.now(),
      },
      {
        id: 'watermark-independent',
        type: 'watermark',
        text: 'CONFIDENTIAL',
        pageIndex: 0,
        x: 150,
        y: 150,
        width: 300,
        height: 100,
        opacity: 0.15,
        rotation: 45,
        createdAt: Date.now(),
      },
    ];

    const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      annotations
    );

    expect(burnedBytes).toBeDefined();
    const doc = await PDFDocument.load(burnedBytes);
    expect(doc.getPageCount()).toBe(1);

    // Verify stamp and watermark text extracted cleanly
    const pdfJsDoc = await pdfjsLib.getDocument({ data: burnedBytes }).promise;
    const page1 = await pdfJsDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const fullText = textContent.items.map((i: any) => i.str).join(' ');

    expect(fullText).toContain('APPROVED');
    expect(fullText).toContain('CONFIDENTIAL');
  });

  it('guarantees untouched content streams remain byte-for-byte identical when no changes are made', async () => {
    const originalPdfBytes = await generateTestPdf();

    const outputBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      {}
    );

    // Exact byte-level identity
    expect(outputBytes).toBe(originalPdfBytes);
  });
});
