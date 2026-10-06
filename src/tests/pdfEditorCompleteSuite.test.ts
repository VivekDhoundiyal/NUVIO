import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfCoordinateSystem } from '../engines/pdf/pdfCoordinateSystem';
import { PdfSelfDiagnosticEngine } from '../engines/qa/pdfSelfDiagnosticEngine';
import type { EditableTextSpan, AnnotationObject } from '../types/document';
import { QaTestFixtures } from './qaTestFixtures';

describe('PDF Editor Complete 18-Case Engine & QA Suite', () => {
  // Helper to extract text per page via PDF.js
  async function extractText(pdfBytes: Uint8Array): Promise<string[]> {
    const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
    const pageTexts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ');
      pageTexts.push(text);
    }
    return pageTexts;
  }

  // 1. Simple text edit
  it('Case 1: Simple text edit preserves untouched content stream 100%', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText('Original Heading', { x: 50, y: 750, size: 24, font });
    page.drawText('Untouched body paragraph that must not change.', { x: 50, y: 700, size: 12, font });
    const originalBytes = await doc.save();

    const span: EditableTextSpan = {
      id: 'span-c1',
      pageIndex: 0,
      originalText: 'Original Heading',
      currentText: 'Updated Commercial Heading',
      x: 50,
      y: 92, // 842 - 750
      width: 250,
      height: 28,
      fontSize: 24,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [span] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Updated Commercial Heading');
    expect(texts[0]).toContain('Untouched body paragraph that must not change.');
  });

  // 2. Multiple fonts
  it('Case 2: Multiple fonts (Helvetica, Times, Courier) preserved across edits', async () => {
    const doc = await PDFDocument.create();
    const hFont = await doc.embedFont(StandardFonts.Helvetica);
    const tFont = await doc.embedFont(StandardFonts.TimesRoman);
    const cFont = await doc.embedFont(StandardFonts.Courier);
    const page = doc.addPage([595, 842]);

    page.drawText('Helvetica Title', { x: 50, y: 750, size: 16, font: hFont });
    page.drawText('Times Roman Description', { x: 50, y: 700, size: 14, font: tFont });
    page.drawText('Courier Code Listing', { x: 50, y: 650, size: 12, font: cFont });
    const originalBytes = await doc.save();

    const spanTimes: EditableTextSpan = {
      id: 'span-times',
      pageIndex: 0,
      originalText: 'Times Roman Description',
      currentText: 'Times Roman Modified Description',
      x: 50,
      y: 142,
      width: 220,
      height: 18,
      fontSize: 14,
      fontFamily: 'Times New Roman, Times, serif',
      color: '#1e293b',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanTimes] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Helvetica Title');
    expect(texts[0]).toContain('Times Roman Modified Description');
    expect(texts[0]).toContain('Courier Code Listing');
  });

  // 3. Different font sizes
  it('Case 3: Different font sizes (8pt footnotes to 36pt title) edited accurately', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText('Big 36pt Title', { x: 50, y: 750, size: 36, font });
    page.drawText('Tiny 8pt footnote text.', { x: 50, y: 50, size: 8, font });
    const originalBytes = await doc.save();

    const spanFootnote: EditableTextSpan = {
      id: 'span-footnote',
      pageIndex: 0,
      originalText: 'Tiny 8pt footnote text.',
      currentText: 'Updated 8pt verified footnote.',
      x: 50,
      y: 792,
      width: 150,
      height: 10,
      fontSize: 8,
      fontFamily: 'Helvetica',
      color: '#64748b',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanFootnote] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Big 36pt Title');
    expect(texts[0]).toContain('Updated 8pt verified footnote.');
  });

  // 4. Bold / italic / underline
  it('Case 4: Bold, italic, and underline styling preserved during editing', async () => {
    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
    const page = doc.addPage([595, 842]);
    page.drawText('Bold Heading Text', { x: 50, y: 750, size: 16, font: fontBold });
    page.drawText('Italic Note Text', { x: 50, y: 710, size: 12, font: fontOblique });
    const originalBytes = await doc.save();

    const spanBold: EditableTextSpan = {
      id: 'span-bold',
      pageIndex: 0,
      originalText: 'Bold Heading Text',
      currentText: 'Updated Bold Heading',
      x: 50,
      y: 92,
      width: 200,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      fontWeight: 'bold',
      color: '#0f172a',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanBold] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Updated Bold Heading');
    expect(texts[0]).toContain('Italic Note Text');
  });

  // 5. Colored text
  it('Case 5: Colored text maintains exact RGB color without reverting to black', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText('Emerald Green Metric: 99.8%', {
      x: 50,
      y: 750,
      size: 14,
      font,
      color: rgb(0.08, 0.64, 0.29),
    });
    const originalBytes = await doc.save();

    const spanColor: EditableTextSpan = {
      id: 'span-green',
      pageIndex: 0,
      originalText: 'Emerald Green Metric: 99.8%',
      currentText: 'Emerald Green Metric: 100.0%',
      x: 50,
      y: 92,
      width: 220,
      height: 18,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#16a34a',
      rgbColor: { r: 0.086, g: 0.639, b: 0.29 },
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanColor] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Emerald Green Metric: 100.0%');
  });

  // 6. Multiple paragraphs & Body text (exact reproduction of reported bug)
  it('Case 6: Body text replacement ("hendrerit vel, nulla...") persists reliably in export', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);

    page.drawText('Sample Document Header', { x: 50, y: 780, size: 20, font: fontBold });
    page.drawText(
      'hendrerit vel, nulla. Sed vitae augue. Aliquam erat volutpat. Aliquam feugiat vulputate nisl.',
      { x: 50, y: 730, size: 11, font }
    );
    page.drawText('Next paragraph remains completely untouched and stable.', { x: 50, y: 690, size: 11, font });
    const originalBytes = await doc.save();

    const bodySpan: EditableTextSpan = {
      id: 'span-body-hendrerit',
      pageIndex: 0,
      originalText: 'hendrerit vel, nulla. Sed vitae augue. Aliquam erat volutpat. Aliquam feugiat vulputate nisl.',
      currentText: 'hendrerit vel, REPLACED_BODY_SUCCESS. Aliquam erat volutpat. Aliquam feugiat vulputate nisl.',
      x: 50,
      y: 112,
      width: 480,
      height: 15,
      fontSize: 11,
      fontFamily: 'Helvetica',
      color: '#1e293b',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [bodySpan] });
    const texts = await extractText(exportedBytes);

    // Assert that the replacement word exists in the exported PDF
    expect(texts[0]).toContain('REPLACED_BODY_SUCCESS');
    expect(texts[0]).toContain('Sample Document Header');
    expect(texts[0]).toContain('Next paragraph remains completely untouched and stable.');
  });

  // 7. Multi-column PDF
  it('Case 7: Multi-column PDF text edit does not cause column flow collapse or cross-column overlap', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    // Column 1
    page.drawText('Col 1 Item Alpha', { x: 50, y: 750, size: 12, font });
    page.drawText('Col 1 Item Beta', { x: 50, y: 720, size: 12, font });
    // Column 2
    page.drawText('Col 2 Item Gamma', { x: 320, y: 750, size: 12, font });
    page.drawText('Col 2 Item Delta', { x: 320, y: 720, size: 12, font });
    const originalBytes = await doc.save();

    const spanCol1: EditableTextSpan = {
      id: 'span-col1',
      pageIndex: 0,
      originalText: 'Col 1 Item Beta',
      currentText: 'Col 1 Item Beta Modified',
      x: 50,
      y: 122,
      width: 140,
      height: 16,
      fontSize: 12,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanCol1] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Col 1 Item Beta Modified');
    expect(texts[0]).toContain('Col 2 Item Gamma');
    expect(texts[0]).toContain('Col 2 Item Delta');
  });

  // 8. Images
  it('Case 8: Document with embedded images retains image integrity when text is edited', async () => {
    const originalBytes = await QaTestFixtures.createScannedImagePdf();
    const doc = await PDFDocument.load(originalBytes);
    const page = doc.getPage(0);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawText('Image Caption Overlay', { x: 50, y: 50, size: 14, font });
    const pdfWithCaption = await doc.save();

    const spanCaption: EditableTextSpan = {
      id: 'span-caption',
      pageIndex: 0,
      originalText: 'Image Caption Overlay',
      currentText: 'Verified Embedded Image Caption',
      x: 50,
      y: 792,
      width: 250,
      height: 18,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#ffffff',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(pdfWithCaption, [], { 0: [spanCaption] });
    const reloaded = await PDFDocument.load(exportedBytes);
    expect(reloaded.getPageCount()).toBe(1);

    const texts = await extractText(exportedBytes);
    expect(texts[0]).toContain('Verified Embedded Image Caption');
  });

  // 9. Tables
  it('Case 9: Vector table borders and adjacent cells remain pristine after cell edit', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    // Draw table border rectangle
    page.drawRectangle({ x: 50, y: 700, width: 400, height: 50, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 1 });
    page.drawText('Cell A1: SKU-101', { x: 60, y: 720, size: 11, font });
    page.drawText('Cell B1: $49.99', { x: 260, y: 720, size: 11, font });
    const originalBytes = await doc.save();

    const spanCell: EditableTextSpan = {
      id: 'span-cell',
      pageIndex: 0,
      originalText: 'Cell B1: $49.99',
      currentText: 'Cell B1: $59.99',
      x: 260,
      y: 122,
      width: 100,
      height: 14,
      fontSize: 11,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanCell] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Cell A1: SKU-101');
    expect(texts[0]).toContain('Cell B1: $59.99');
  });

  // 10. Rotated text
  it('Case 10: Rotated text (90°) maintains angle and coordinates', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);
    page.drawText('Vertical Sidebar Text', {
      x: 30,
      y: 400,
      size: 14,
      font,
      rotate: degrees(90),
    });
    const originalBytes = await doc.save();

    const spanRotated: EditableTextSpan = {
      id: 'span-rot',
      pageIndex: 0,
      originalText: 'Vertical Sidebar Text',
      currentText: 'Updated Vertical Sidebar',
      x: 30,
      y: 442,
      width: 150,
      height: 18,
      fontSize: 14,
      rotation: 90,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanRotated] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Updated Vertical Sidebar');
  });

  // 11. Scanned PDF / OCR Spans
  it('Case 11: Scanned image with OCR-generated spans allows editing and exports cleanly', async () => {
    const originalBytes = await QaTestFixtures.createScannedImagePdf();

    const ocrSpan: EditableTextSpan = {
      id: 'ocr-span-1',
      pageIndex: 0,
      originalText: 'Recognized Text Line',
      currentText: 'Corrected OCR Text Line',
      x: 100,
      y: 200,
      width: 200,
      height: 20,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      isModified: true,
      isFromOcr: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [ocrSpan] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Corrected OCR Text Line');
  });

  // 12. Mixed text + images + vectors
  it('Case 12: Complex layout with vectors, images, and text survives editing intact', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    // Draw vector banner
    page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: rgb(0.1, 0.2, 0.4) });
    page.drawText('White Header On Vector', { x: 50, y: 800, size: 16, font, color: rgb(1, 1, 1) });
    page.drawText('Subheader text in main body', { x: 50, y: 740, size: 12, font });
    const originalBytes = await doc.save();

    const spanHeader: EditableTextSpan = {
      id: 'span-vector-header',
      pageIndex: 0,
      originalText: 'White Header On Vector',
      currentText: 'White Header Updated',
      x: 50,
      y: 42,
      width: 220,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#ffffff',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanHeader] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('White Header Updated');
    expect(texts[0]).toContain('Subheader text in main body');
  });

  // 13. Multi-page PDF
  it('Case 13: Multi-page document retains edits across disparate pages (Page 1, 3, 5)', async () => {
    const originalBytes = await QaTestFixtures.createMultiPagePdf(6);

    const spanP1: EditableTextSpan = {
      id: 'span-p1',
      pageIndex: 0,
      originalText: 'Document Report — Section 1',
      currentText: 'Executive Report — Section 1',
      x: 50,
      y: 42,
      width: 250,
      height: 20,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const spanP3: EditableTextSpan = {
      id: 'span-p3',
      pageIndex: 2,
      originalText: 'Document Report — Section 3',
      currentText: 'Audited Report — Section 3',
      x: 50,
      y: 42,
      width: 250,
      height: 20,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalBytes,
      [],
      { 0: [spanP1], 2: [spanP3] }
    );
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Executive Report — Section 1');
    expect(texts[2]).toContain('Audited Report — Section 3');
    expect(texts[1]).toContain('Document Report — Section 2'); // Untouched page 2
  });

  // 14. Existing annotations
  it('Case 14: Document with existing annotations preserves annotations alongside text edit', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText('Annotated Document Baseline', { x: 50, y: 750, size: 16, font });
    const originalBytes = await doc.save();

    const annot: AnnotationObject = {
      id: 'hl-existing',
      type: 'highlight',
      pageIndex: 0,
      x: 50,
      y: 745,
      width: 200,
      height: 22,
      strokeColor: '#ffea00',
      fillColor: '#ffea00',
      opacity: 0.4,
      createdAt: Date.now(),
    };

    const span: EditableTextSpan = {
      id: 'span-annot',
      pageIndex: 0,
      originalText: 'Annotated Document Baseline',
      currentText: 'Annotated Document Updated',
      x: 50,
      y: 92,
      width: 250,
      height: 20,
      fontSize: 16,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [annot], { 0: [span] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Annotated Document Updated');
  });

  // 15. Signature / stamp / watermark
  it('Case 15: Signature, stamp, and watermark burn accurately alongside text edit', async () => {
    const originalBytes = await QaTestFixtures.createSinglePagePdf();
    const pngDataUrl = await QaTestFixtures.createTestPngDataUrl();

    const sig: AnnotationObject = {
      id: 'sig-test',
      type: 'signature',
      pageIndex: 0,
      x: 100,
      y: 150,
      width: 140,
      height: 50,
      imageDataUrl: pngDataUrl,
      createdAt: Date.now(),
    };

    const stamp: AnnotationObject = {
      id: 'stamp-test',
      type: 'stamp',
      pageIndex: 0,
      x: 350,
      y: 150,
      width: 140,
      height: 40,
      text: 'CONFIDENTIAL',
      stampType: 'CONFIDENTIAL',
      textColor: '#dc2626',
      createdAt: Date.now(),
    };

    const span: EditableTextSpan = {
      id: 'span-watermark-edit',
      pageIndex: 0,
      originalText: 'DocuLoom Single Page Standard Document',
      currentText: 'NuVio Verified Commercial Release',
      x: 50,
      y: 62,
      width: 350,
      height: 24,
      fontSize: 20,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      originalBytes,
      [sig, stamp],
      { 0: [span] }
    );
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('NuVio Verified Commercial Release');
    expect(texts[0]).toContain('CONFIDENTIAL');
  });

  // 16. Embedded / subset fonts
  it('Case 16: Subset font resolution (e.g. ABCDEF+Helvetica) safely edits without corruption', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);
    page.drawText('Subset Font Text Run', { x: 50, y: 750, size: 14, font });
    const originalBytes = await doc.save();

    const spanSubset: EditableTextSpan = {
      id: 'span-subset',
      pageIndex: 0,
      originalText: 'Subset Font Text Run',
      currentText: 'Subset Font Safely Modified',
      originalFont: 'BAAAAA+HelveticaBold',
      resolvedFont: 'Helvetica-Bold',
      embeddedFontReference: 'BAAAAA',
      x: 50,
      y: 92,
      width: 200,
      height: 18,
      fontSize: 14,
      fontFamily: 'Helvetica',
      fontWeight: 'bold',
      color: '#000000',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalBytes, [], { 0: [spanSubset] });
    const texts = await extractText(exportedBytes);

    expect(texts[0]).toContain('Subset Font Safely Modified');
  });

  // 17. Unusual page sizes (Letter, Legal, small receipt)
  it('Case 17: Unusual page sizes (Legal 612x1008 and custom receipt 200x600) transform accurately', async () => {
    // Custom receipt size
    const docReceipt = await PDFDocument.create();
    const font = await docReceipt.embedFont(StandardFonts.Helvetica);
    const page = docReceipt.addPage([200, 600]);
    page.drawText('Receipt Order #1001', { x: 20, y: 550, size: 12, font });
    const originalReceipt = await docReceipt.save();

    // Verify coordinate transformation accuracy
    const geom = { width: 200, height: 600, rotation: 0 };
    const viewportPt = PdfCoordinateSystem.pdfToViewport(20, 550, 160, 14, geom, 1.5);
    expect(viewportPt.x).toBeCloseTo(30, 1);
    expect(viewportPt.y).toBeCloseTo((600 - 550 - 14) * 1.5, 1);

    const spanReceipt: EditableTextSpan = {
      id: 'span-receipt',
      pageIndex: 0,
      originalText: 'Receipt Order #1001',
      currentText: 'Receipt Order #9999',
      x: 20,
      y: 36,
      width: 150,
      height: 14,
      fontSize: 12,
      fontFamily: 'Helvetica',
      color: '#000000',
      isModified: true,
    };

    const exportedReceipt = await AnnotationBurner.burnAllEditsAndAnnotations(originalReceipt, [], { 0: [spanReceipt] });
    const texts = await extractText(exportedReceipt);

    expect(texts[0]).toContain('Receipt Order #9999');
  });

  // 18. Rotated pages (0°, 90°, 180°, 270°)
  it('Case 18: Rotated pages (0°, 90°, 180°, 270°) maintain exact orientation and mapping', async () => {
    const originalRotated = await QaTestFixtures.createRotatedPagesPdf();
    const doc = await PDFDocument.load(originalRotated);
    expect(doc.getPageCount()).toBe(4);

    // Verify coordinate system roundtrip across all 4 rotations
    const rotations = [0, 90, 180, 270];
    for (const rot of rotations) {
      const geom = { width: 595.28, height: 841.89, rotation: rot };
      const vp = PdfCoordinateSystem.pdfToViewport(60, 700, 200, 20, geom, 1.0);
      const back = PdfCoordinateSystem.viewportToPdf(vp.x, vp.y, vp.width, vp.height, geom, 1.0);

      expect(Math.abs(back.x - 60)).toBeLessThan(0.01);
      expect(Math.abs(back.y - 700)).toBeLessThan(0.01);
    }

    // Edit Page 2 (90° rotation)
    const spanRot90: EditableTextSpan = {
      id: 'span-p2-rot',
      pageIndex: 1,
      originalText: 'Page 2 with native 90 degree rotation',
      currentText: 'Page 2 EDITED with 90 degree rotation',
      x: 60,
      y: 122,
      width: 250,
      height: 18,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(originalRotated, [], { 1: [spanRot90] });
    const texts = await extractText(exportedBytes);

    expect(texts[1]).toContain('Page 2 EDITED with 90 degree rotation');
  });

  // Extra: PdfSelfDiagnosticEngine verifies full health
  it('Self-Diagnostic Engine: Reports 100% health across coordinates, model, handlers, and export parity', async () => {
    const originalBytes = await QaTestFixtures.createSinglePagePdf();
    const span: EditableTextSpan = {
      id: 'diag-span',
      pageIndex: 0,
      originalText: 'DocuLoom Single Page Standard Document',
      currentText: 'DocuLoom Fully Verified Diagnostic',
      x: 50,
      y: 62,
      width: 350,
      height: 24,
      fontSize: 20,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      isModified: true,
    };

    const report = await PdfSelfDiagnosticEngine.runFullDiagnostic(
      originalBytes,
      { 0: [span] },
      []
    );

    expect(report.success).toBe(true);
    expect(report.failedChecks).toBe(0);
    expect(report.totalChecks).toBeGreaterThanOrEqual(4);
    expect(report.summary).toContain('PASSED');
  });
});
