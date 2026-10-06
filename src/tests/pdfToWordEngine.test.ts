import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import mammoth from 'mammoth';
import { PdfToWordEngine } from '../engines/conversion/pdfToWordEngine';

describe('PdfToWordEngine — High-Fidelity Conversion & Validation', () => {
  async function createSamplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const timesFont = await doc.embedFont(StandardFonts.TimesRoman);

    // Page 1: Portrait Invoice with Title, Table-like Columns, Colors
    const page1 = doc.addPage([595, 842]); // A4 Portrait

    page1.drawText('ACME INVOICE #1042', {
      x: 50,
      y: 780,
      size: 22,
      font,
      color: rgb(0.1, 0.2, 0.8), // Blue heading
    });

    page1.drawText('Billed To: John Doe Enterprises', {
      x: 50,
      y: 740,
      size: 12,
      font: timesFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Column headers
    page1.drawText('Description', { x: 50, y: 700, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('Qty', { x: 300, y: 700, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('Amount', { x: 450, y: 700, size: 11, font, color: rgb(0.1, 0.1, 0.1) });

    // Row 1
    page1.drawText('Software Development Consulting', { x: 50, y: 675, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('10', { x: 300, y: 675, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('$1,500.00', { x: 450, y: 675, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });

    // Row 2
    page1.drawText('Cloud Migration Services', { x: 50, y: 650, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('5', { x: 300, y: 650, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
    page1.drawText('$750.00', { x: 450, y: 650, size: 11, font: regularFont, color: rgb(0.1, 0.1, 0.1) });

    // Total
    page1.drawText('Total Due: $2,250.00', {
      x: 350,
      y: 600,
      size: 14,
      font,
      color: rgb(0.8, 0.1, 0.1), // Red total
    });

    // Embed small image
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGACUCA/4g+55YAAAAAElFTkSuQmCC',
      'base64'
    );
    const img = await doc.embedPng(samplePng);
    page1.drawImage(img, { x: 50, y: 500, width: 40, height: 40 });

    // Page 2: Landscape Page
    const page2 = doc.addPage([842, 595]); // Landscape
    page2.drawText('Quarterly Revenue Analytics (Landscape)', {
      x: 60,
      y: 520,
      size: 18,
      font,
      color: rgb(0.05, 0.4, 0.2),
    });

    return await doc.save();
  }

  it('converts multi-page PDF to DOCX preserving text, layout, and page structure', async () => {
    const pdfBytes = await createSamplePdf();

    const progressLogs: string[] = [];
    const docxBytes = await PdfToWordEngine.convertPdfToDocx(pdfBytes, (_pct, msg) => {
      progressLogs.push(msg);
    });

    expect(docxBytes).toBeDefined();
    expect(docxBytes.byteLength).toBeGreaterThan(1000);

    // Verify OpenXML ZIP header: PK\x03\x04
    expect(docxBytes[0]).toBe(0x50);
    expect(docxBytes[1]).toBe(0x4b);
    expect(docxBytes[2]).toBe(0x03);
    expect(docxBytes[3]).toBe(0x04);

    // Extract text from the generated DOCX via Mammoth to verify content fidelity
    const mammothResult = await mammoth.extractRawText({
      buffer: Buffer.from(docxBytes),
    });
    const docxText = mammothResult.value;

    expect(docxText).toContain('ACME INVOICE #1042');
    expect(docxText).toContain('John Doe Enterprises');
    expect(docxText).toContain('Software Development Consulting');
    expect(docxText).toContain('$2,250.00');
    expect(docxText).toContain('Quarterly Revenue Analytics');

    // Confirm that no internal debugging strings or parser tags leaked in
    expect(docxText).not.toContain('Graphic content');
    expect(docxText).not.toContain('Image/Graphic Page');
  });

  it('validates conversion fidelity and catches corrupted files', async () => {
    const pdfBytes = await createSamplePdf();
    const docxBytes = await PdfToWordEngine.convertPdfToDocx(pdfBytes);

    const validation = await PdfToWordEngine.validateConversion(docxBytes, 2, 20);
    expect(validation.passed).toBe(true);
    expect(validation.pageCount).toBe(2);
    expect(validation.textExtractedCount).toBeGreaterThan(50);
    expect(validation.errors).toHaveLength(0);

    // Validation should fail on invalid bytes
    const badBytes = new Uint8Array([0, 1, 2, 3]);
    const badValidation = await PdfToWordEngine.validateConversion(badBytes, 1, 10);
    expect(badValidation.passed).toBe(false);
    expect(badValidation.errors.length).toBeGreaterThan(0);
  });

  it('converts rich complex PDF with multiple fonts, headings, paragraphs, colors, and alignments into structured DOCX', async () => {
    const doc = await PDFDocument.create();
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);
    const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const courier = await doc.embedFont(StandardFonts.Courier);

    const page = doc.addPage([595, 842]);

    // 1. Centered Main Document Heading (H1)
    page.drawText('Quarterly Business Performance Report', {
      x: 95,
      y: 780,
      size: 22,
      font: helvBold,
      color: rgb(0.1, 0.25, 0.7),
    });

    // 2. Section Heading (H2)
    page.drawText('1. Executive Overview', {
      x: 50,
      y: 730,
      size: 16,
      font: helvBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 3. Multi-line paragraph in Times Roman
    page.drawText('During the last quarter, DocuLoom achieved extraordinary performance benchmarks across all local-first workflows.', {
      x: 50,
      y: 695,
      size: 11,
      font: timesRoman,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText('Client-side processing delivered zero-latency document editing without external data transmission.', {
      x: 50,
      y: 678,
      size: 11,
      font: timesItalic,
      color: rgb(0.2, 0.2, 0.2),
    });

    // 4. Courier monospace code / reference snippet
    page.drawText('System Hash: SHA256-8A7B9C4E0F1234567890ABCDEF', {
      x: 50,
      y: 640,
      size: 10,
      font: courier,
      color: rgb(0.3, 0.3, 0.3),
    });

    // 5. Section Heading 2 (H2)
    page.drawText('2. Financial Breakdown', {
      x: 50,
      y: 600,
      size: 16,
      font: helvBold,
      color: rgb(0.15, 0.15, 0.15),
    });

    // 6. Tabular content
    page.drawText('Category', { x: 50, y: 565, size: 11, font: helvBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Allocation', { x: 250, y: 565, size: 11, font: helvBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('Variance', { x: 420, y: 565, size: 11, font: helvBold, color: rgb(0.1, 0.1, 0.1) });

    page.drawText('Engineering & Architecture', { x: 50, y: 540, size: 11, font: helv, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('$45,000', { x: 250, y: 540, size: 11, font: helv, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('+2.4%', { x: 420, y: 540, size: 11, font: helv, color: rgb(0.1, 0.6, 0.2) });

    page.drawText('Quality Assurance & Testing', { x: 50, y: 515, size: 11, font: helv, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('$28,500', { x: 250, y: 515, size: 11, font: helv, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('-1.1%', { x: 420, y: 515, size: 11, font: helv, color: rgb(0.8, 0.1, 0.1) });

    // 7. Right-aligned footer/signoff
    page.drawText('Approved by Board of Directors', {
      x: 320,
      y: 460,
      size: 11,
      font: helvBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    const richPdfBytes = await doc.save();
    const docxBytes = await PdfToWordEngine.convertPdfToDocx(richPdfBytes);

    expect(docxBytes).toBeDefined();
    expect(docxBytes.byteLength).toBeGreaterThan(1500);

    // Verify text extracted via mammoth
    const mammothResult = await mammoth.extractRawText({
      buffer: Buffer.from(docxBytes),
    });
    const docxText = mammothResult.value;

    expect(docxText).toContain('Quarterly Business Performance Report');
    expect(docxText).toContain('1. Executive Overview');
    expect(docxText).toContain('DocuLoom achieved extraordinary performance');
    expect(docxText).toContain('Client-side processing delivered');
    expect(docxText).toContain('SHA256-8A7B9C4E0F1234567890ABCDEF');
    expect(docxText).toContain('2. Financial Breakdown');
    expect(docxText).toContain('Engineering & Architecture');
    expect(docxText).toContain('$45,000');
    expect(docxText).toContain('Approved by Board of Directors');
  });
});
