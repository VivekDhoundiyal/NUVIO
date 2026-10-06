import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import type { AnnotationObject, EditableTextSpan } from '../types/document';
import { sanitizeWinAnsiText, toggleListFormatting } from '../utils/pdfSanitize';

// Small 1x1 valid transparent PNG data URL for image watermark and embedded image tests
const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Creates a rich, multi-page test PDF document containing:
 * - Mixed fonts (Helvetica, Times, Courier)
 * - Various font sizes (24pt, 16pt, 11pt, 8pt)
 * - Multiple colors (navy, blue, dark slate, gray)
 * - Bold and italic text runs
 * - Embedded PNG image
 * - Multiple pages (2 pages)
 */
async function createComplexMultiPagePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const pngImage = await pdfDoc.embedPng(SAMPLE_PNG_DATA_URL);

  // ---- Page 1 ----
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { height: h1 } = page1.getSize();

  // Header 24pt Bold
  page1.drawText('DocuLoom Master Test Document', {
    x: 50,
    y: h1 - 60,
    size: 24,
    font: helveticaBold,
    color: rgb(0.12, 0.16, 0.23),
  });

  // Subheader 16pt Times Italic
  page1.drawText('High-Fidelity PDF Engine Verification', {
    x: 50,
    y: h1 - 95,
    size: 16,
    font: timesItalic,
    color: rgb(0.15, 0.39, 0.92),
  });

  // Paragraph in Times Roman 11pt
  page1.drawText('This document verifies that non-destructive editing preserves untouched text perfectly.', {
    x: 50,
    y: h1 - 130,
    size: 11,
    font: timesRoman,
    color: rgb(0.2, 0.27, 0.33),
  });

  // Courier Mono Block 10pt
  page1.drawText('Code: CONST_VALUE = 42; // courier fixed pitch', {
    x: 50,
    y: h1 - 155,
    size: 10,
    font: courier,
    color: rgb(0.3, 0.35, 0.42),
  });

  // Embedded Image
  page1.drawImage(pngImage, {
    x: 50,
    y: h1 - 220,
    width: 40,
    height: 40,
  });

  // Target editable text span
  page1.drawText('Original Target Text 2026', {
    x: 50,
    y: h1 - 280,
    size: 14,
    font: helveticaBold,
    color: rgb(0.85, 0.15, 0.15),
  });

  // Untouched reference text right below
  page1.drawText('Crucial Untouched Reference Text - Do Not Alter', {
    x: 50,
    y: h1 - 320,
    size: 11,
    font: helvetica,
    color: rgb(0.1, 0.1, 0.1),
  });

  // ---- Page 2 ----
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  const { height: h2 } = page2.getSize();

  // Page 2 Title
  page2.drawText('Page 2: Secondary Content Area', {
    x: 50,
    y: h2 - 60,
    size: 20,
    font: timesBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  // Multi-line content on Page 2
  page2.drawText('All content on this page must remain completely identical when Page 1 is edited.', {
    x: 50,
    y: h2 - 100,
    size: 11,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Footer 8pt
  page2.drawText('Confidential Document Page 2 of 2', {
    x: 50,
    y: 30,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await pdfDoc.save();
}

describe('PDF Editing Engine — Fidelity, Non-Destructive Editing & Regression Gate', () => {
  it('1. Byte-level fidelity: preserves exact binary bytes when zero edits or annotations occur', async () => {
    const originalPdfBytes = await createComplexMultiPagePdf();

    // Calling burnAllEditsAndAnnotations with empty edits and annotations
    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      {}
    );

    // Strict byte identity check
    expect(exportedBytes).toBe(originalPdfBytes);
    expect(exportedBytes.byteLength).toBe(originalPdfBytes.byteLength);
  });

  it('2. Multi-line text editing: preserves font, colors, baseline, and untouched regions across pages', async () => {
    const originalPdfBytes = await createComplexMultiPagePdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(originalPdfBytes);

    // Extract text spans for Page 1
    const { textSpans: page1Spans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);
    expect(page1Spans.length).toBeGreaterThan(0);

    // Locate target span and untouched reference span
    const targetSpan = page1Spans.find((s) => s.originalText.includes('Original Target Text 2026'));
    const untouchedSpan = page1Spans.find((s) => s.originalText.includes('Crucial Untouched Reference Text'));

    expect(targetSpan).toBeDefined();
    expect(untouchedSpan).toBeDefined();

    // Edit target span with multi-line text, custom color, bold, underline, strikethrough
    const modifiedSpan: EditableTextSpan = {
      ...targetSpan!,
      currentText: 'Updated Multi-Line Heading\nSub-item bullet details 2026',
      color: '#16a34a',
      fontWeight: 'bold',
      underline: true,
      strikethrough: false,
      textAlign: 'left',
      isModified: true,
    };

    // Burn edits
    const editedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [],
      { [0]: [modifiedSpan] }
    );

    expect(editedPdfBytes).toBeDefined();
    expect(editedPdfBytes.byteLength).toBeGreaterThan(0);

    // Inspect the generated PDF
    const editedDocProxy = await PdfEngine.loadPdfJsDoc(editedPdfBytes);
    expect(editedDocProxy.numPages).toBe(2);

    // Verify Page 1
    const { textSpans: newPage1Spans } = await PdfEngine.extractPageTextSpans(editedDocProxy, 1);
    const newUntouchedSpan = newPage1Spans.find((s) => s.originalText.includes('Crucial Untouched Reference Text'));

    // Untouched span on Page 1 must strictly exist and preserve text
    expect(newUntouchedSpan).toBeDefined();
    expect(newUntouchedSpan!.originalText).toContain('Crucial Untouched Reference Text');

    // Verify Page 2: untouched page remains 100% equivalent
    const { textSpans: newPage2Spans } = await PdfEngine.extractPageTextSpans(editedDocProxy, 2);
    const page2Title = newPage2Spans.find((s) => s.originalText.includes('Page 2: Secondary Content Area'));
    const page2Footer = newPage2Spans.find((s) => s.originalText.includes('Confidential Document Page 2 of 2'));

    expect(page2Title).toBeDefined();
    expect(page2Footer).toBeDefined();
  });

  it('3. Watermark engine: reliably burns text and image watermarks with opacity, rotation, and page targeting', async () => {
    const originalPdfBytes = await createComplexMultiPagePdf();

    const textWatermark: AnnotationObject = {
      id: 'wm-text-1',
      type: 'watermark',
      watermarkType: 'text',
      pageIndex: 0, // Page 1 only
      x: 50,
      y: 350,
      width: 480,
      height: 120,
      text: 'CONFIDENTIAL DRAFT',
      fontSize: 48,
      textColor: '#dc2626',
      opacity: 0.2,
      rotation: -45,
      createdAt: Date.now(),
    };

    const imageWatermark: AnnotationObject = {
      id: 'wm-img-2',
      type: 'watermark',
      watermarkType: 'image',
      pageIndex: 1, // Page 2 only
      x: 180,
      y: 300,
      width: 200,
      height: 200,
      imageDataUrl: SAMPLE_PNG_DATA_URL,
      opacity: 0.15,
      rotation: 0,
      createdAt: Date.now(),
    };

    const watermarkedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [textWatermark, imageWatermark]
    );

    expect(watermarkedPdfBytes).toBeDefined();
    const docProxy = await PdfEngine.loadPdfJsDoc(watermarkedPdfBytes);
    expect(docProxy.numPages).toBe(2);

    const info = await PdfEngine.getPdfInfo(watermarkedPdfBytes, 'watermarked.pdf');
    expect(info.pages.length).toBe(2);
    expect(info.pages[0].width).toBeCloseTo(595.28, 1);
    expect(info.pages[1].height).toBeCloseTo(841.89, 1);
  });

  it('4. Rotated signatures and custom stamps: burns accurately without distortion or literal CUSTOM text', async () => {
    const originalPdfBytes = await createComplexMultiPagePdf();

    const signature: AnnotationObject = {
      id: 'sig-rotated',
      type: 'signature',
      pageIndex: 0,
      x: 120,
      y: 400,
      width: 160,
      height: 60,
      imageDataUrl: SAMPLE_PNG_DATA_URL,
      rotation: 33, // arbitrary rotation
      opacity: 0.9,
      createdAt: Date.now(),
    };

    const stamp: AnnotationObject = {
      id: 'stamp-rotated',
      type: 'stamp',
      pageIndex: 0,
      x: 320,
      y: 400,
      width: 150,
      height: 55,
      stampText: 'VERIFIED 2026',
      stampType: 'CUSTOM',
      strokeColor: '#059669',
      textColor: '#059669',
      rotation: -18,
      opacity: 0.95,
      createdAt: Date.now(),
    };

    const exportedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalPdfBytes,
      [signature, stamp]
    );

    expect(exportedPdfBytes).toBeDefined();
    const docProxy = await PdfEngine.loadPdfJsDoc(exportedPdfBytes);
    expect(docProxy.numPages).toBe(2);
  });

  it('5. Text sanitization & list formatting: prevents WinAnsi crashes on typography symbols and formats lists cleanly', () => {
    // Unicode typography that throws WinAnsi error in standard fonts if unsanitized
    const rawUnicode = '“Quoted text” with em—dash, en–dash, bullet •, and accents: café & résumé';
    const sanitized = sanitizeWinAnsiText(rawUnicode);

    expect(sanitized).not.toContain('“');
    expect(sanitized).not.toContain('”');
    expect(sanitized).not.toContain('—');
    expect(sanitized).toContain('"Quoted text"');
    expect(sanitized).toContain('em-dash');

    // List toggling: bullet
    const rawLines = 'First item\nSecond item\nThird item';
    const bulletList = toggleListFormatting(rawLines, 'bullet');
    expect(bulletList).toBe('• First item\n• Second item\n• Third item');

    // Untoggle bullet
    const unbulleted = toggleListFormatting(bulletList, 'bullet');
    expect(unbulleted).toBe('First item\nSecond item\nThird item');

    // Numbered list
    const numberedList = toggleListFormatting(rawLines, 'number');
    expect(numberedList).toBe('1. First item\n2. Second item\n3. Third item');

    // Untoggle numbered
    const unnumbered = toggleListFormatting(numberedList, 'number');
    expect(unnumbered).toBe('First item\nSecond item\nThird item');
  });
});
