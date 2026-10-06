import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { ValidationEngine } from '../engines/validation/validationEngine';

describe('PdfEngine', () => {
  async function createSamplePdf(numPages = 2): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < numPages; i++) {
      const page = doc.addPage([400, 600]);
      page.drawText(`Sample Page ${i + 1}`, { x: 50, y: 500, size: 16 });
    }
    return await doc.save();
  }

  it('correctly merges multiple PDF documents', async () => {
    const pdf1 = await createSamplePdf(2);
    const pdf2 = await createSamplePdf(3);

    const mergedBytes = await PdfEngine.mergePdfs([pdf1, pdf2]);
    expect(mergedBytes).toBeDefined();
    expect(mergedBytes.byteLength).toBeGreaterThan(0);

    const resultDoc = await PDFDocument.load(mergedBytes);
    expect(resultDoc.getPageCount()).toBe(5);
  });

  it('correctly splits PDF pages by ranges', async () => {
    const pdf = await createSamplePdf(4);
    const ranges = [
      { start: 0, end: 1 }, // pages 1 and 2
      { start: 2, end: 3 }, // pages 3 and 4
    ];

    const splitParts = await PdfEngine.splitPdf(pdf, ranges);
    expect(splitParts.length).toBe(2);

    const part1 = await PDFDocument.load(splitParts[0]);
    expect(part1.getPageCount()).toBe(2);

    const part2 = await PDFDocument.load(splitParts[1]);
    expect(part2.getPageCount()).toBe(2);
  });

  it('correctly adds text watermark to pages', async () => {
    const pdf = await createSamplePdf(2);
    const watermarked = await PdfEngine.addTextWatermark(pdf, 'TEST-WATERMARK', {
      fontSize: 32,
      opacity: 0.3,
    });

    expect(watermarked).toBeDefined();
    const resultDoc = await PDFDocument.load(watermarked);
    expect(resultDoc.getPageCount()).toBe(2);
  });

  it('correctly adds page numbers to pages', async () => {
    const pdf = await createSamplePdf(3);
    const numbered = await PdfEngine.addPageNumbers(pdf, {
      position: 'bottom-center',
      format: 'Page {n} of {total}',
    });

    expect(numbered).toBeDefined();
    const resultDoc = await PDFDocument.load(numbered);
    expect(resultDoc.getPageCount()).toBe(3);
  });

  it('validates generated PDF using ValidationEngine', async () => {
    const pdf = await createSamplePdf(2);
    const report = await ValidationEngine.validatePdfOutput(pdf, {
      expectedPageCount: 2,
      operationName: 'Test Validation',
      originalPageCount: 2,
      originalSizeBytes: pdf.byteLength,
    });

    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.outputSummary.pageCount).toBe(2);
  });
});
