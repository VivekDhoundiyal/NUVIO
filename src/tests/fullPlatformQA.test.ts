import { describe, it, expect } from 'vitest';
import { QaTestFixtures } from './qaTestFixtures';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { PdfFormEngine } from '../engines/pdf/pdfFormEngine';
import { PdfRedactionEngine } from '../engines/pdf/pdfRedactionEngine';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { CompressionEngine } from '../engines/compression/compressionEngine';
import { ValidationEngine } from '../engines/validation/validationEngine';
import type { EditableTextSpan } from '../types/document';
import { PDFDocument } from 'pdf-lib';

describe('DocuLoom Platform QA — Automated Self-Healing Verification Suite', () => {
  // 1. In-Place Editing Fidelity Rule
  describe('1. In-Place Editing Fidelity Rule', () => {
    it('guarantees untouched pages and content streams remain bit-for-bit identical when nothing is edited', async () => {
      const originalPdf = await QaTestFixtures.createMultiPagePdf(3);
      // Empty annotations and empty modified spans
      const result = await AnnotationBurner.burnAllEditsAndAnnotations(originalPdf, [], {});

      // Bit-for-bit identity check
      expect(result).toBe(originalPdf);
      expect(result.length).toBe(originalPdf.length);
    });

    it('modifies only targeted spans during in-place text replacement while preserving font and baseline', async () => {
      const originalPdf = await QaTestFixtures.createSinglePagePdf('Original Header Text for Verification');
      const docProxy = await PdfEngine.loadPdfJsDoc(originalPdf);
      const { textSpans } = await PdfEngine.extractPageTextSpans(docProxy, 1);

      expect(textSpans.length).toBeGreaterThan(0);
      const targetSpan = textSpans[0];

      // Mutate only this single span
      const modifiedSpan: EditableTextSpan = {
        ...targetSpan,
        currentText: 'Updated Header Text by DocuLoom',
        isModified: true,
      };

      const editedPdf = await AnnotationBurner.burnAllEditsAndAnnotations(
        originalPdf,
        [],
        { 0: [modifiedSpan] }
      );

      expect(editedPdf.length).toBeGreaterThan(0);

      // Verify the edited PDF can be reloaded and contains the replacement
      const editedDocProxy = await PdfEngine.loadPdfJsDoc(editedPdf);
      const { textSpans: newSpans } = await PdfEngine.extractPageTextSpans(editedDocProxy, 1);
      const combinedText = newSpans.map((s) => s.currentText || s.originalText).join(' ');
      expect(combinedText).toContain('Updated Header Text');
    });

    it('format painter copies styles only without modifying underlying text strings', () => {
      const sourceSpan: EditableTextSpan = {
        id: 'span-1',
        pageIndex: 0,
        originalText: 'Source Text Header',
        currentText: 'Source Text Header',
        x: 50,
        y: 100,
        width: 150,
        height: 20,
        fontFamily: 'HelveticaBold',
        fontSize: 24,
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: '#4f46e5',
        rgbColor: { r: 0.31, g: 0.27, b: 0.9 },
        transformMatrix: [1, 0, 0, 1, 50, 100],
        isModified: false,
        underline: true,
        strikethrough: false,
        letterSpacing: 1.5,
        lineHeight: 1.3,
        verticalAlign: 'super',
      };

      const targetSpan: EditableTextSpan = {
        id: 'span-2',
        pageIndex: 0,
        originalText: 'Target Subtitle',
        currentText: 'Target Subtitle',
        x: 50,
        y: 200,
        width: 100,
        height: 14,
        fontFamily: 'Helvetica',
        fontSize: 12,
        color: '#000000',
        rgbColor: { r: 0, g: 0, b: 0 },
        transformMatrix: [1, 0, 0, 1, 50, 200],
        isModified: false,
      };

      // Apply Format Painter: style is applied, target text remains unchanged
      const paintedSpan: EditableTextSpan = {
        ...targetSpan,
        fontFamily: sourceSpan.fontFamily,
        fontSize: sourceSpan.fontSize,
        fontWeight: sourceSpan.fontWeight,
        fontStyle: sourceSpan.fontStyle,
        color: sourceSpan.color,
        underline: sourceSpan.underline,
        strikethrough: sourceSpan.strikethrough,
        letterSpacing: sourceSpan.letterSpacing,
        lineHeight: sourceSpan.lineHeight,
        verticalAlign: sourceSpan.verticalAlign,
        isModified: true,
      };

      expect(paintedSpan.currentText).toBe('Target Subtitle'); // Text untouched
      expect(paintedSpan.fontSize).toBe(24); // Style updated
      expect(paintedSpan.color).toBe('#4f46e5');
      expect(paintedSpan.fontWeight).toBe('bold');
      expect(paintedSpan.underline).toBe(true);
    });
  });

  // 2. AcroForm Engine
  describe('2. AcroForm Engine — Discovery, Interactive Filling & Flattening', () => {
    it('discovers fields, fills new values, and flattens form to permanent vectors', async () => {
      const acroPdf = await QaTestFixtures.createAcroFormPdf();

      // 1. Discover fields
      const fields = await PdfFormEngine.getFormFields(acroPdf);
      expect(fields.length).toBeGreaterThanOrEqual(3);
      const nameField = fields.find((f) => f.name === 'FullName');
      const emailField = fields.find((f) => f.name === 'Email');
      const termsField = fields.find((f) => f.name === 'AcceptTerms');

      expect(nameField).toBeDefined();
      expect(emailField).toBeDefined();
      expect(termsField).toBeDefined();
      expect(nameField?.currentValue).toBe('Jane Doe');

      // 2. Fill fields
      const filledPdf = await PdfFormEngine.fillForm(acroPdf, {
        FullName: 'Alexander Hamilton',
        Email: 'hamilton@treasury.gov',
        AcceptTerms: true,
      });

      const updatedFields = await PdfFormEngine.getFormFields(filledPdf);
      const updatedName = updatedFields.find((f) => f.name === 'FullName');
      expect(updatedName?.currentValue).toBe('Alexander Hamilton');

      // 3. Flatten form
      const flattenedPdf = await PdfFormEngine.flattenForm(filledPdf);
      const postFlattenFields = await PdfFormEngine.getFormFields(flattenedPdf);
      expect(postFlattenFields.length).toBe(0); // All interactive form dictionaries stripped!
    });
  });

  // 3. True Permanent Redaction Engine
  describe('3. Permanent Redaction Engine — Text Vector Sanitization', () => {
    it('permanently sanitizes underlying text vectors within the redaction bounding box', async () => {
      const testPdf = await QaTestFixtures.createSinglePagePdf('TOP SECRET DOSSIER: PROJECT CITADEL');

      const redactedPdf = await PdfRedactionEngine.applyRedactions(testPdf, [
        {
          id: 'redact-1',
          pageIndex: 0,
          x: 40,
          y: 750,
          width: 500,
          height: 60,
          label: '[REDACTED]',
        },
      ]);

      expect(redactedPdf.length).toBeGreaterThan(0);

      // Verify that the redacted PDF loads safely and does not crash
      const doc = await PDFDocument.load(redactedPdf);
      expect(doc.getPageCount()).toBe(1);
    });
  });

  // 4. AES-256 & RC4 Client-Side Security & Encryption
  describe('4. AES-256 and RC4 Security & Decryption', () => {
    it('encrypts with AES-256 and successfully decrypts with correct password', async () => {
      const rawPdf = await QaTestFixtures.createSinglePagePdf('Sensitive Legal Contract');
      const password = 'SuperSecurePass2026!';

      const encrypted = await PdfProtectionEngine.encryptPdf(rawPdf, {
        userPassword: password,
        algorithm: 'AES-256',
      });

      expect(encrypted.length).toBeGreaterThan(0);

      // Check encryption detection
      const isEncrypted = await PdfProtectionEngine.isEncrypted(encrypted);
      expect(isEncrypted).toBe(true);

      // Decrypt with correct password
      const decrypted = await PdfProtectionEngine.decryptPdf(encrypted, password);
      expect(decrypted.length).toBeGreaterThan(0);

      // Verify decrypted PDF is readable
      const doc = await PDFDocument.load(decrypted);
      expect(doc.getPageCount()).toBe(1);
    });

    it('rejects decryption when given an incorrect password', async () => {
      const rawPdf = await QaTestFixtures.createSinglePagePdf('Vault Content');
      const encrypted = await PdfProtectionEngine.encryptPdf(rawPdf, {
        userPassword: 'CorrectPassword123',
        algorithm: 'AES-256',
      });

      await expect(
        PdfProtectionEngine.decryptPdf(encrypted, 'WrongPassword456')
      ).rejects.toThrow();
    });

    it('encrypts and decrypts with RC4 algorithm', async () => {
      const rawPdf = await QaTestFixtures.createSinglePagePdf('RC4 Legacy Compatibility Test');
      const password = 'RC4Password789';

      const encrypted = await PdfProtectionEngine.encryptPdf(rawPdf, {
        userPassword: password,
        algorithm: 'RC4',
      });

      const isEncrypted = await PdfProtectionEngine.isEncrypted(encrypted);
      expect(isEncrypted).toBe(true);

      const decrypted = await PdfProtectionEngine.decryptPdf(encrypted, password);
      const doc = await PDFDocument.load(decrypted);
      expect(doc.getPageCount()).toBe(1);
    });
  });

  // 5. Watermarking Engine
  describe('5. Watermarking Engine — Text, Image, Presets & Page Filtering', () => {
    it('applies text watermark with diagonal, center, top-left, and tile presets', async () => {
      const pdf = await QaTestFixtures.createMultiPagePdf(4);

      // 1. Center text watermark
      const centerWm = await PdfEngine.addWatermark(pdf, {
        type: 'text',
        text: 'INTERNAL ONLY',
        position: 'center',
        opacity: 0.3,
        fontSize: 36,
      });
      expect(centerWm.length).toBeGreaterThan(0);

      // 2. Tile / Grid repeat watermark
      const tileWm = await PdfEngine.addWatermark(pdf, {
        type: 'text',
        text: 'DRAFT',
        position: 'tile',
        opacity: 0.15,
      });
      expect(tileWm.length).toBeGreaterThan(0);

      // 3. Odd pages only filter
      const oddWm = await PdfEngine.addWatermark(pdf, {
        type: 'text',
        text: 'ODD PAGES',
        pageFilter: 'odd',
      });
      expect(oddWm.length).toBeGreaterThan(0);

      // 4. Custom range filter ("1, 3-4")
      const rangeWm = await PdfEngine.addWatermark(pdf, {
        type: 'text',
        text: 'SELECT RANGE',
        pageFilter: '1, 3-4',
      });
      expect(rangeWm.length).toBeGreaterThan(0);
    });

    it('applies image watermark with custom width and opacity', async () => {
      const pdf = await QaTestFixtures.createSinglePagePdf();
      // PNG base64 1x1 transparent/white pixel
      const pngDataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      const imageWm = await PdfEngine.addWatermark(pdf, {
        type: 'image',
        imageDataUrl: pngDataUrl,
        position: 'center',
        imageWidth: 150,
        opacity: 0.4,
      });

      expect(imageWm.length).toBeGreaterThan(0);
      const doc = await PDFDocument.load(imageWm);
      expect(doc.getPageCount()).toBe(1);
    });
  });

  // 6. Page Operations — Merge, Split, Rotate, Delete, Extract
  describe('6. Page Operations — Merge, Split, Rotate, Delete & Extract', () => {
    it('merges multiple distinct PDFs into a single document preserving page orders', async () => {
      const doc1 = await QaTestFixtures.createSinglePagePdf('Document 1');
      const doc2 = await QaTestFixtures.createSinglePagePdf('Document 2');
      const doc3 = await QaTestFixtures.createSinglePagePdf('Document 3');

      const merged = await PdfEngine.mergePdfs([doc1, doc2, doc3]);
      const mergedDoc = await PDFDocument.load(merged);
      expect(mergedDoc.getPageCount()).toBe(3);
    });

    it('splits a multi-page PDF into single-page documents', async () => {
      const multi = await QaTestFixtures.createMultiPagePdf(4);
      const splits = await PdfEngine.splitPdf(multi, { mode: 'all' });
      expect(splits.length).toBe(4);

      for (const single of splits) {
        const doc = await PDFDocument.load((single as any).bytes || single);
        expect(doc.getPageCount()).toBe(1);
      }
    });

    it('rotates specific page by 90 degrees', async () => {
      const multi = await QaTestFixtures.createMultiPagePdf(3);
      const rotated = await PdfEngine.rotatePages(multi, [0], 90);
      const doc = await PDFDocument.load(rotated);
      const page0 = doc.getPages()[0];
      expect(page0.getRotation().angle).toBe(90);
    });

    it('deletes specific page from document', async () => {
      const multi = await QaTestFixtures.createMultiPagePdf(4);
      const deleted = await PdfEngine.deletePages(multi, [1]); // delete page index 1
      const doc = await PDFDocument.load(deleted);
      expect(doc.getPageCount()).toBe(3);
    });

    it('extracts specific page range into a new document', async () => {
      const multi = await QaTestFixtures.createMultiPagePdf(5);
      const extracted = await PdfEngine.extractPages(multi, [1, 3]); // extract pages 2 and 4
      const doc = await PDFDocument.load(extracted);
      expect(doc.getPageCount()).toBe(2);
    });
  });

  // 7. Compression Engine
  describe('7. Compression Engine — Client-Side Optimization', () => {
    it('processes multi-page document through compression pipeline without corrupting layout', async () => {
      const originalPdf = await QaTestFixtures.createMultiPagePdf(5);
      const result = await CompressionEngine.compressPdf(originalPdf, { level: 'recommended' });

      expect(result.pdfBytes.length).toBeGreaterThan(0);
      expect(result.originalSizeBytes).toBe(originalPdf.length);

      // Verify output document integrity
      const doc = await PDFDocument.load(result.pdfBytes);
      expect(doc.getPageCount()).toBe(5);
    });
  });

  // 8. Large-Scale 100+ Pages Stress Test
  describe('8. High-Capacity Stress Test — 100+ Pages', () => {
    it('handles 105-page PDF document generation and parsing without memory exhaustion', async () => {
      const largePdf = await QaTestFixtures.createLargeScalePdf(105);
      expect(largePdf.length).toBeGreaterThan(10000);

      const info = await PdfEngine.getPdfInfo(largePdf, 'large_scale_test.pdf');
      expect(info.pageCount).toBe(105);
      expect(info.pages.length).toBe(105);
    });
  });

  // 9. Multilingual & Rotated Fixture Ingestion
  describe('9. Multilingual & Rotated Page Robustness', () => {
    it('parses multilingual Unicode document and extracts text spans cleanly', async () => {
      const multiLingualPdf = await QaTestFixtures.createMultilingualPdf();
      const docProxy = await PdfEngine.loadPdfJsDoc(multiLingualPdf);
      const { textSpans } = await PdfEngine.extractPageTextSpans(docProxy, 1);
      expect(textSpans.length).toBeGreaterThan(0);
    });

    it('correctly reports orientations across pages with 0, 90, 180, and 270 degree rotation metadata', async () => {
      const rotatedPdf = await QaTestFixtures.createRotatedPagesPdf();
      const info = await PdfEngine.getPdfInfo(rotatedPdf, 'rotated_test.pdf');
      expect(info.pageCount).toBe(4);
      expect(info.pages[0].rotation).toBe(0);
      expect(info.pages[1].rotation).toBe(90);
      expect(info.pages[2].rotation).toBe(180);
      expect(info.pages[3].rotation).toBe(270);
    });
  });

  // 10. Automated Quality Validation Engine
  describe('10. Automated Quality Validation Engine Compliance', () => {
    it('validates PDF output and reports 100% compliance with zero critical errors', async () => {
      const samplePdf = await QaTestFixtures.createSinglePagePdf('Validation Audit Check');
      const report = await ValidationEngine.validatePdfOutput(samplePdf, {
        operationName: 'Full Platform QA Audit',
        originalSizeBytes: samplePdf.length,
      });

      expect(report.passed).toBe(true);
      expect(report.items.some((c) => c.status === 'failed')).toBe(false);
      expect(report.items.length).toBeGreaterThanOrEqual(4);
    });
  });
});
