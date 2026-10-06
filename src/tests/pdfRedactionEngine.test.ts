import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfRedactionEngine } from '../engines/pdf/pdfRedactionEngine';

describe('PdfRedactionEngine — Permanent Redaction & Vector Blackout', () => {
  async function createTestDocument(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('Account Number: 9876-5432-1098', {
      x: 50,
      y: 400,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText('Customer Name: John Public', {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    return await doc.save();
  }

  it('returns original document when redaction areas list is empty', async () => {
    const original = await createTestDocument();
    const result = await PdfRedactionEngine.applyPermanentRedactions(original, []);

    expect(result.redactedAreaCount).toBe(0);
    expect(result.pdfBytes.length).toBe(original.length);
  });

  it('burns opaque vector blackouts and audits intersecting text items', async () => {
    const original = await createTestDocument();

    const redactions = [
      {
        id: 'redact-account-number',
        pageIndex: 0,
        x: 45,
        y: 85, // in top-left coords, roughly where Account Number sits
        width: 250,
        height: 25,
      },
    ];

    const result = await PdfRedactionEngine.applyPermanentRedactions(original, redactions);

    expect(result.redactedAreaCount).toBe(1);
    expect(result.pdfBytes.length).toBeGreaterThan(0);

    // Verify output document loads cleanly
    const savedDoc = await PDFDocument.load(result.pdfBytes);
    expect(savedDoc.getPageCount()).toBe(1);
  });
});
