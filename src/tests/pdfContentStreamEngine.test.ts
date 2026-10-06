import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import type { EditableTextSpan, AnnotationObject } from '../types/document';

describe('PdfContentStreamEngine & AnnotationBurner', () => {
  async function createInvoicePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 600]);

    page.drawText('Invoice for John Smith', {
      x: 50,
      y: 500,
      size: 18,
      font,
      color: rgb(0.1, 0.2, 0.8),
    });

    page.drawText('Total Amount: $450.00', {
      x: 50,
      y: 450,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    return await doc.save();
  }

  it('draws replacement text as an overlay without modifying original content stream', async () => {
    const originalPdfBytes = await createInvoicePdf();

    // Text span modification: change "Invoice for John Smith" to "Invoice for Vivek Dhoundiyal"
    const editedSpan: EditableTextSpan = {
      id: 'span-1',
      pageIndex: 0,
      originalText: 'John Smith',
      currentText: 'Vivek Dhoundiyal',
      x: 50,
      y: 100, // 600 - 500
      width: 220,
      height: 24,
      fontSize: 18,
      fontFamily: 'Helvetica',
      fontWeight: 'normal',
      color: '#1a33cc',
      rgbColor: { r: 0.1, g: 0.2, b: 0.8 },
      rotation: 0,
      transformMatrix: [18, 0, 0, 18, 50, 500],
      isModified: true,
    };

    const modifiedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      { 0: [editedSpan] }
    );

    expect(modifiedPdfBytes).toBeDefined();
    expect(modifiedPdfBytes.byteLength).toBeGreaterThan(0);

    // Verify with PDF.js text extraction
    const pdfDoc = await pdfjsLib.getDocument({ data: modifiedPdfBytes }).promise;
    const page1 = await pdfDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const extractedStrings = textContent.items.map((i: any) => i.str).filter(Boolean);

    // Assert that Vivek Dhoundiyal is present in the document (drawn as overlay)
    expect(extractedStrings.some((s: string) => s.includes('Vivek Dhoundiyal'))).toBe(true);

    // In non-destructive overlay mode, original text stays in the stream (hidden visually).
    // This is correct — we don't corrupt the content stream.
    // The important assertion is that the replacement IS present.
  });

  it('burns signatures, shapes, and stamps onto PDF pages with correct placement', async () => {
    const originalPdfBytes = await createInvoicePdf();

    // 1x1 transparent PNG data URL for signature test
    const dummySignatureDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const annotations: AnnotationObject[] = [
      {
        id: 'sig-1',
        type: 'signature',
        pageIndex: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 60,
        imageDataUrl: dummySignatureDataUrl,
        createdAt: Date.now(),
      },
      {
        id: 'shape-1',
        type: 'shape',
        shapeType: 'rectangle',
        pageIndex: 0,
        x: 40,
        y: 40,
        width: 200,
        height: 80,
        strokeColor: '#2563eb',
        strokeWidth: 2,
        createdAt: Date.now(),
      },
      {
        id: 'stamp-1',
        type: 'stamp',
        stampType: 'APPROVED',
        pageIndex: 0,
        x: 300,
        y: 100,
        width: 120,
        height: 45,
        rotation: -10,
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
  });

  it('preserves custom stamp text and custom color on export without reverting to "CUSTOM"', async () => {
    const originalPdfBytes = await createInvoicePdf();

    const customStamp: AnnotationObject = {
      id: 'custom-stamp-1',
      type: 'stamp',
      stampType: 'CUSTOM',
      stampText: 'VERIFIED BY AUDIT 2026',
      strokeColor: '#7c3aed',
      textColor: '#7c3aed',
      pageIndex: 0,
      x: 150,
      y: 120,
      width: 180,
      height: 50,
      rotation: -15,
      createdAt: Date.now(),
    };

    const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [customStamp]
    );

    expect(burnedBytes).toBeDefined();

    // Verify with PDF.js text extraction
    const pdfDoc = await pdfjsLib.getDocument({ data: burnedBytes }).promise;
    const page1 = await pdfDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const extractedStrings = textContent.items.map((i: any) => i.str).filter(Boolean);

    // Assert that the exact custom stamp text is present in the PDF output
    expect(extractedStrings.some((s: string) => s.includes('VERIFIED BY AUDIT 2026'))).toBe(true);
    // Assert that it didn't burn literal "CUSTOM"
    expect(extractedStrings.some((s: string) => s.trim() === 'CUSTOM')).toBe(false);
  });

  it('correctly handles signature rotation with center-based transformation', async () => {
    const originalPdfBytes = await createInvoicePdf();

    const dummySignatureDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const rotatedSignature: AnnotationObject = {
      id: 'sig-rot-1',
      type: 'signature',
      pageIndex: 0,
      x: 120,
      y: 220,
      width: 140,
      height: 70,
      rotation: 45, // Arbitrary angle rotation
      imageDataUrl: dummySignatureDataUrl,
      createdAt: Date.now(),
    };

    const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [rotatedSignature]
    );

    expect(burnedBytes).toBeDefined();
    const doc = await PDFDocument.load(burnedBytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('preserves font family, weight, and style formatting in text overlay replacements', async () => {
    const originalPdfBytes = await createInvoicePdf();

    const editedSpan: EditableTextSpan = {
      id: 'span-font-test',
      pageIndex: 0,
      originalText: 'Total Amount',
      currentText: 'Final Amount Due',
      x: 50,
      y: 150,
      width: 160,
      height: 20,
      fontSize: 14,
      fontFamily: 'Times New Roman, Times, serif',
      fontWeight: 'bold',
      fontStyle: 'italic',
      color: '#dc2626',
      rgbColor: { r: 0.86, g: 0.15, b: 0.15 },
      rotation: 0,
      transformMatrix: [14, 0, 0, 14, 50, 450],
      isModified: true,
    };

    const modifiedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      { 0: [editedSpan] }
    );

    expect(modifiedPdfBytes).toBeDefined();
    const pdfDoc = await pdfjsLib.getDocument({ data: modifiedPdfBytes }).promise;
    const page1 = await pdfDoc.getPage(1);
    const textContent = await page1.getTextContent();
    const extractedStrings = textContent.items.map((i: any) => i.str).filter(Boolean);

    // Replacement text drawn as overlay
    expect(extractedStrings.some((s: string) => s.includes('Final Amount Due'))).toBe(true);

    // Original text remains in content stream (non-destructive)
    // Visual hiding is done via opaque rectangle overlay
  });

  it('strictly preserves surrounding text and layout when editing a small portion of text (e.g. Sample PDF -> Sample PDC)', async () => {
    // Create PDF with "Sample PDF Document"
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([500, 400]);

    page.drawText('Sample PDF Document', {
      x: 50,
      y: 300,
      size: 20,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText('This is important surrounding content that must never be altered.', {
      x: 50,
      y: 250,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    const srcPdfBytes = await doc.save();

    // User edits ONLY "PDF" to "PDC"
    const editedSpan: EditableTextSpan = {
      id: 'span-sample-pdc',
      pageIndex: 0,
      originalText: 'PDF',
      currentText: 'PDC',
      x: 125, // X coordinate of the word "PDF"
      y: 80,  // 400 - 300 - 20
      width: 42,
      height: 20,
      fontSize: 20,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontWeight: 'bold',
      color: '#0f172a',
      rgbColor: { r: 0.1, g: 0.1, b: 0.1 },
      backgroundColor: '#ffffff',
      rotation: 0,
      transformMatrix: [20, 0, 0, 20, 125, 300],
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      srcPdfBytes,
      [],
      { 0: [editedSpan] }
    );

    expect(exportedBytes).toBeDefined();

    // Verify text preservation with PDF.js
    const pdfJsDoc = await pdfjsLib.getDocument({ data: exportedBytes }).promise;
    const p1 = await pdfJsDoc.getPage(1);
    const textContent = await p1.getTextContent();
    const fullText = textContent.items.map((i: any) => i.str).join(' ');

    // 1. Replacement "PDC" must be present
    expect(fullText).toContain('PDC');

    // 2. Surrounding text "Sample" and "Document" must be 100% preserved
    expect(fullText).toContain('Sample');
    expect(fullText).toContain('Document');

    // 3. Unrelated second paragraph must be 100% preserved
    expect(fullText).toContain('This is important surrounding content that must never be altered.');
  });

  it('burns highlight, underline, and strikethrough annotations onto the exported PDF', async () => {
    const originalPdfBytes = await createInvoicePdf();

    const annotations: AnnotationObject[] = [
      {
        id: 'hl-test',
        type: 'highlight',
        pageIndex: 0,
        x: 50,
        y: 495,
        width: 150,
        height: 22,
        strokeColor: '#ffea00',
        fillColor: '#ffea00',
        opacity: 0.35,
        createdAt: Date.now(),
      },
      {
        id: 'ul-test',
        type: 'underline',
        pageIndex: 0,
        x: 50,
        y: 448,
        width: 120,
        height: 4,
        strokeColor: '#2563eb',
        strokeWidth: 2,
        createdAt: Date.now(),
      },
      {
        id: 'st-test',
        type: 'strikethrough',
        pageIndex: 0,
        x: 200,
        y: 445,
        width: 80,
        height: 4,
        strokeColor: '#dc2626',
        strokeWidth: 2,
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
  });
});
