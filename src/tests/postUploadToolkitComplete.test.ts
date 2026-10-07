import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { FileSessionStore } from '../services/storage/fileSessionStore';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { PdfToWordEngine } from '../engines/conversion/pdfToWordEngine';
import { CompressionEngine } from '../engines/compression/compressionEngine';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';
import { PdfRedactionEngine } from '../engines/pdf/pdfRedactionEngine';

describe('Post-Upload Toolkit Complete Workflows (All 8 Tools)', () => {
  async function createSamplePdf(pageCount = 3): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([600, 800]);
      page.drawText(`NUVIO Test Document - Page ${i + 1}`, {
        x: 50,
        y: 730,
        size: 18,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText('Confidential Account 1234-5678-9012 for John Doe.', {
        x: 50,
        y: 680,
        size: 12,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText('Browser-native processing without third-party cloud dependencies.', {
        x: 50,
        y: 640,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    return await doc.save();
  }

  // 1. FileSessionStore
  describe('1. FileSessionStore Integration', () => {
    it('manages active session file across tool switches and clears cleanly', async () => {
      const dummyBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
      const file = new File([dummyBytes], 'report.pdf', { type: 'application/pdf' });

      expect(FileSessionStore.getActiveFile()).toBeNull();

      const session = await FileSessionStore.setActiveFile(file);
      expect(session.file.name).toBe('report.pdf');
      expect(FileSessionStore.getActiveFile()?.file.name).toBe('report.pdf');

      FileSessionStore.clear();
      expect(FileSessionStore.getActiveFile()).toBeNull();
    });
  });

  // 2. To Word (DOCX Conversion)
  describe('2. To Word (PdfToWordEngine)', () => {
    it('converts multi-page PDF into valid OpenXML DOCX bytes client-side', async () => {
      const pdfBytes = await createSamplePdf(2);
      const docxBytes = await PdfToWordEngine.convertPdfToDocx(pdfBytes);

      expect(docxBytes).toBeInstanceOf(Uint8Array);
      expect(docxBytes.byteLength).toBeGreaterThan(100);

      // Verify OpenXML ZIP signature: 0x50, 0x4B, 0x03, 0x04 (PK\x03\x04)
      expect(docxBytes[0]).toBe(0x50);
      expect(docxBytes[1]).toBe(0x4b);
      expect(docxBytes[2]).toBe(0x03);
      expect(docxBytes[3]).toBe(0x04);
    });
  });

  // 3. Compress PDF
  describe('3. Compress PDF (CompressionEngine)', () => {
    it('supports 4 presets (recommended, high, balanced, low) without inflating file size', async () => {
      const pdfBytes = await createSamplePdf(2);

      const presets = ['recommended', 'high', 'balanced', 'low'] as const;
      for (const preset of presets) {
        const result = await CompressionEngine.compressPdf(pdfBytes, preset);
        expect(result.originalSizeBytes).toBe(pdfBytes.byteLength);
        expect(result.compressedSizeBytes).toBeLessThanOrEqual(pdfBytes.byteLength);
        expect(result.savedBytes).toBeGreaterThanOrEqual(0);
        expect(result.pdfBytes.byteLength).toBeGreaterThan(0);

        // Verify valid PDF output
        const loaded = await PDFDocument.load(result.pdfBytes);
        expect(loaded.getPageCount()).toBe(2);
      }
    });
  });

  // 4. Watermark PDF
  describe('4. Watermark PDF (PdfEngine.addWatermark)', () => {
    it('applies text watermarks with 9-point grid alignment across pages', async () => {
      const pdfBytes = await createSamplePdf(3);

      const positions = [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'center',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ] as const;

      for (const pos of positions) {
        const watermarked = await PdfEngine.addWatermark(pdfBytes, {
          type: 'text',
          text: 'OFFICIAL COPY',
          position: pos,
          fontSize: 32,
          opacity: 0.3,
        });

        expect(watermarked).toBeInstanceOf(Uint8Array);
        expect(watermarked.byteLength).toBeGreaterThan(0);

        const loaded = await PDFDocument.load(watermarked);
        expect(loaded.getPageCount()).toBe(3);
      }
    });

    it('supports custom page filtering (odd, even, or range)', async () => {
      const pdfBytes = await createSamplePdf(4);

      const oddWatermarked = await PdfEngine.addWatermark(pdfBytes, {
        type: 'text',
        text: 'ODD ONLY',
        pageFilter: 'odd',
      });
      const loadedOdd = await PDFDocument.load(oddWatermarked);
      expect(loadedOdd.getPageCount()).toBe(4);

      const rangeWatermarked = await PdfEngine.addWatermark(pdfBytes, {
        type: 'text',
        text: 'RANGE',
        pageFilter: '2-3',
      });
      const loadedRange = await PDFDocument.load(rangeWatermarked);
      expect(loadedRange.getPageCount()).toBe(4);
    });
  });

  // 5. Protect PDF
  describe('5. Protect PDF (PdfProtectionEngine)', () => {
    it('encrypts document with password and validates encryption header', async () => {
      const pdfBytes = await createSamplePdf(1);
      const password = 'SuperSecretPassword123!';

      const protectedBytes = await PdfProtectionEngine.protectPdf(pdfBytes, {
        userPassword: password,
        algorithm: 'AES-256',
        allowPrinting: true,
        allowCopying: false,
      });

      expect(protectedBytes).toBeInstanceOf(Uint8Array);
      expect(protectedBytes.byteLength).toBeGreaterThan(0);

      // Verify encrypted state
      const isEncrypted = await PdfProtectionEngine.isPdfEncrypted(protectedBytes);
      expect(isEncrypted).toBe(true);

      // Verify unlocking with password
      const unlocked = await PdfProtectionEngine.unlockPdf(protectedBytes, password);
      expect(unlocked.byteLength).toBeGreaterThan(0);
    });

    it('rejects unlocking with wrong password', async () => {
      const pdfBytes = await createSamplePdf(1);
      const protectedBytes = await PdfProtectionEngine.protectPdf(pdfBytes, {
        userPassword: 'CorrectPassword',
      });

      await expect(
        PdfProtectionEngine.unlockPdf(protectedBytes, 'WrongPassword')
      ).rejects.toThrow();
    });
  });

  // 6. Split PDF
  describe('6. Split PDF (PdfEngine.splitPdf)', () => {
    it('splits every page into individual documents', async () => {
      const pdfBytes = await createSamplePdf(3);
      const parts = await PdfEngine.splitPdf(pdfBytes, { mode: 'all' });

      expect(parts.length).toBe(3);
      for (const part of parts) {
        const loaded = await PDFDocument.load(part);
        expect(loaded.getPageCount()).toBe(1);
      }
    });

    it('splits custom ranges into distinct multi-page documents', async () => {
      const pdfBytes = await createSamplePdf(5);
      const ranges = [
        { start: 0, end: 1 }, // pages 1-2 (2 pages)
        { start: 2, end: 4 }, // pages 3-5 (3 pages)
      ];

      const parts = await PdfEngine.splitPdf(pdfBytes, ranges);
      expect(parts.length).toBe(2);

      const doc1 = await PDFDocument.load(parts[0]);
      expect(doc1.getPageCount()).toBe(2);

      const doc2 = await PDFDocument.load(parts[1]);
      expect(doc2.getPageCount()).toBe(3);
    });

    it('supports chunk splitting (every N pages)', async () => {
      const pdfBytes = await createSamplePdf(5);
      const chunkSize = 2;
      const totalPages = 5;

      const ranges: { start: number; end: number }[] = [];
      for (let i = 0; i < totalPages; i += chunkSize) {
        ranges.push({ start: i, end: Math.min(totalPages - 1, i + chunkSize - 1) });
      }

      const parts = await PdfEngine.splitPdf(pdfBytes, ranges);
      expect(parts.length).toBe(3); // [1-2], [3-4], [5]

      const doc1 = await PDFDocument.load(parts[0]);
      expect(doc1.getPageCount()).toBe(2);
      const doc3 = await PDFDocument.load(parts[2]);
      expect(doc3.getPageCount()).toBe(1);
    });
  });

  // 7. Redact PDF
  describe('7. Redact PDF (PdfRedactionEngine)', () => {
    it('applies true binary stream sanitization and draws opaque blackouts', async () => {
      const pdfBytes = await createSamplePdf(2);

      const redactions = [
        {
          id: 'redact-account',
          pageIndex: 0,
          x: 40,
          y: 110, // top-left coordinate corresponding to Confidential Account line
          width: 350,
          height: 30,
        },
      ];

      const result = await PdfRedactionEngine.applyPermanentRedactions(pdfBytes, redactions);
      expect(result.redactedAreaCount).toBe(1);
      expect(result.pdfBytes.byteLength).toBeGreaterThan(0);

      // Verify sanitized document loads cleanly
      const sanitizedDoc = await PDFDocument.load(result.pdfBytes);
      expect(sanitizedDoc.getPageCount()).toBe(2);
    });
  });
});
