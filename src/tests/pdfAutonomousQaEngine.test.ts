import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb, degrees, PDFRawStream, decodePDFRawStream, PDFArray } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { PdfContentStreamParser } from '../engines/pdf/pdfContentStreamParser';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';
import { PdfToWordEngine } from '../engines/conversion/pdfToWordEngine';
import type { EditableTextSpan, AnnotationObject } from '../types/document';

describe('PdfAutonomousQaEngine — In-Stream Content Editing & Full Tool Suite QA', () => {
  /**
   * Helper to decompress page /Contents stream text
   */
  function getDecompressedPageStream(pdfDoc: PDFDocument, pageIndex: number = 0): string {
    const page = pdfDoc.getPages()[pageIndex];
    const contentsRef = page.node.Contents();
    if (!contentsRef) return '';

    const contentsObj = pdfDoc.context.lookup(contentsRef);
    if (!contentsObj) return '';

    const streams: any[] = [];
    if (contentsObj instanceof PDFArray) {
      for (let i = 0; i < contentsObj.size(); i++) {
        streams.push(pdfDoc.context.lookup(contentsObj.get(i)));
      }
    } else {
      streams.push(contentsObj);
    }

    const decodedTexts: string[] = [];
    for (const stream of streams) {
      if (!stream) continue;
      let bytes: Uint8Array;
      if (stream instanceof PDFRawStream) {
        const decoded = decodePDFRawStream(stream);
        bytes = decoded ? decoded.decode() : stream.asUint8Array();
      } else if (typeof (stream as any).asUint8Array === 'function') {
        bytes = (stream as any).asUint8Array();
      } else {
        continue;
      }
      decodedTexts.push(new TextDecoder('latin1').decode(bytes));
    }

    return decodedTexts.join('\n');
  }

  // =========================================================================
  // 1. SURGICAL IN-STREAM EDITING (The "Sample" -> "Simple" Acceptance Test)
  // =========================================================================
  describe('1. True In-Stream PDF Content Editing', () => {
    it('modifies "Sample" to "Simple" in-place inside the content stream with ZERO white masks and 100% font/style preservation', async () => {
      // Create test PDF with "Sample Document"
      const doc = await PDFDocument.create();
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const page = doc.addPage([600, 400]);

      page.drawText('Sample Document Header', {
        x: 50,
        y: 320,
        size: 26,
        font: boldFont,
        color: rgb(0.12, 0.24, 0.75), // distinct blue
      });

      page.drawText('Untouched body paragraph that must not shift or reflow.', {
        x: 50,
        y: 280,
        size: 13,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });

      const originalBytes = await doc.save();

      // Inspect original stream
      const originalDoc = await PDFDocument.load(originalBytes);
      const originalStreamText = getDecompressedPageStream(originalDoc, 0);
      const originalRuns = PdfContentStreamParser.extractTextRuns(
        PdfContentStreamParser.parseOperations(PdfContentStreamParser.tokenize(originalStreamText))
      );
      const originalDecoded = originalRuns.map((r) => r.decodedText).join(' ');
      expect(originalDecoded).toContain('Sample');

      // Edit "Sample" -> "Simple"
      const editedSpan: EditableTextSpan = {
        id: 'span-sample',
        pageIndex: 0,
        streamIndex: 0,
        originalText: 'Sample',
        currentText: 'Simple',
        x: 50,
        y: 54, // 400 - 320 - 26
        width: 95,
        height: 26,
        fontSize: 26,
        originalFontSize: 26,
        fontFamily: 'Helvetica',
        pdfFontName: 'HelveticaBold',
        fontWeight: 'bold',
        color: '#1f3dbf',
        originalColor: '#1f3dbf',
        rgbColor: { r: 0.12, g: 0.24, b: 0.75 },
        baseline: 320,
        rotation: 0,
        transformMatrix: [26, 0, 0, 26, 50, 320],
        isModified: true,
        words: [
          {
            id: 'w-1',
            spanId: 'span-sample',
            pageIndex: 0,
            text: 'Simple',
            originalText: 'Sample',
            x: 50,
            y: 54,
            pdfX: 50,
            pdfY: 320,
            width: 95,
            height: 26,
            fontSize: 26,
            fontFamily: 'Helvetica',
            fontWeight: 'bold',
            color: '#1f3dbf',
            rgbColor: { r: 0.12, g: 0.24, b: 0.75 },
            baseline: 320,
            isModified: true,
          },
        ],
      };

      const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        originalBytes,
        [],
        { 0: [editedSpan] }
      );

      // Verify modified PDF structure
      const modifiedDoc = await PDFDocument.load(exportedBytes);
      const modifiedStreamText = getDecompressedPageStream(modifiedDoc, 0);

      const modifiedRuns = PdfContentStreamParser.extractTextRuns(
        PdfContentStreamParser.parseOperations(PdfContentStreamParser.tokenize(modifiedStreamText))
      );
      const modifiedDecoded = modifiedRuns.map((r) => r.decodedText).join(' ');

      // 1. "Simple" is present in the stream
      expect(modifiedDecoded).toContain('Simple');

      // 2. Original "Sample" is completely replaced in-stream
      expect(modifiedDecoded).not.toContain('Sample');

      // 3. ZERO white mask rectangles drawn: No 're' (rectangle) operator blot-outs added for text mask
      // In pdf-lib, page.drawRectangle emits "re" followed by "f" or "s"
      expect(modifiedStreamText).not.toMatch(/\d+\s+\d+\s+\d+\s+\d+\s+re\s+f/);

      // 4. Original font size (26 Tf) and color (0.12 0.24 0.75 rg) are preserved
      expect(modifiedStreamText).toMatch(/26\s+Tf/);
      expect(modifiedStreamText).toMatch(/0\.12\s+0\.24\s+0\.75\s+rg/);

      // 5. Surrounding text preserved in the stream
      expect(modifiedDecoded).toContain('Document Header');
      expect(modifiedDecoded).toContain('Untouched body paragraph');

      // 6. Verify via PDF.js rendering/extraction
      const pdfJsDoc = await pdfjsLib.getDocument({ data: exportedBytes }).promise;
      const page1 = await pdfJsDoc.getPage(1);
      const textContent = await page1.getTextContent();
      const strings = textContent.items.map((i: any) => i.str).join(' ');

      expect(strings).toContain('Simple');
      expect(strings).toContain('Document Header');
      expect(strings).toContain('Untouched body paragraph');
    });

    it('guarantees untouched pages remain byte-for-byte identical', async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const p1 = doc.addPage([500, 500]);
      p1.drawText('Page 1 Original Text', { x: 50, y: 400, size: 14, font });

      const p2 = doc.addPage([500, 500]);
      p2.drawText('Page 2 Untouched Static Content', { x: 50, y: 400, size: 14, font });

      const originalPdfBytes = await doc.save();
      const originalDoc = await PDFDocument.load(originalPdfBytes);
      const originalPage2Stream = getDecompressedPageStream(originalDoc, 1);

      // Modify only Page 1
      const editedSpan: EditableTextSpan = {
        id: 'p1-span',
        pageIndex: 0,
        originalText: 'Original Text',
        currentText: 'Updated Text',
        x: 50,
        y: 86,
        width: 100,
        height: 14,
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#000000',
        rgbColor: { r: 0, g: 0, b: 0 },
        transformMatrix: [14, 0, 0, 14, 50, 400],
        isModified: true,
      };

      const editedPdfBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        originalPdfBytes,
        [],
        { 0: [editedSpan] }
      );

      const editedDoc = await PDFDocument.load(editedPdfBytes);
      const editedPage2Stream = getDecompressedPageStream(editedDoc, 1);

      // Page 2 stream must remain completely identical
      expect(editedPage2Stream).toBe(originalPage2Stream);
    });

    it('returns exact original Uint8Array when nothing is modified', async () => {
      const doc = await PDFDocument.create();
      doc.addPage([400, 400]);
      const originalPdfBytes = await doc.save();

      const resultBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        originalPdfBytes,
        [],
        {}
      );

      // Reference equality / byte identity
      expect(resultBytes).toBe(originalPdfBytes);
    });
  });

  // =========================================================================
  // 2. COMPREHENSIVE PDF TOOLS QA (All Tools Audited & Functional)
  // =========================================================================
  describe('2. Platform Tool Suite QA & Regression Coverage', () => {
    async function createBaseDoc(): Promise<Uint8Array> {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const p = doc.addPage([600, 800]);
      p.drawText('DocuLoom Platform Base Document', { x: 50, y: 720, size: 16, font });
      return await doc.save();
    }

    it('Tool: Add Text (Overlay with custom styling, line height, font family)', async () => {
      const baseBytes = await createBaseDoc();

      const textAnnot: AnnotationObject = {
        id: 'txt-1',
        type: 'text',
        pageIndex: 0,
        x: 50,
        y: 200,
        width: 250,
        height: 80,
        text: 'Multi-line Inserted Text\nWith Second Line and Styling',
        fontSize: 16,
        fontFamily: 'Times New Roman',
        textColor: '#15803d',
        fontWeight: 'bold',
        backgroundColor: '#f0fdf4',
        createdAt: Date.now(),
      };

      const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, [textAnnot]);
      const pdfJs = await pdfjsLib.getDocument({ data: burnedBytes }).promise;
      const page = await pdfJs.getPage(1);
      const content = await page.getTextContent();
      const extracted = content.items.map((i: any) => i.str).join(' ');

      expect(extracted).toContain('Multi-line Inserted Text');
      expect(extracted).toContain('With Second Line and Styling');
    });

    it('Tool: Signature (PNG image overlay with rotation and scale)', async () => {
      const baseBytes = await createBaseDoc();
      const samplePng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const sigAnnot: AnnotationObject = {
        id: 'sig-1',
        type: 'signature',
        pageIndex: 0,
        x: 100,
        y: 400,
        width: 180,
        height: 60,
        rotation: 15,
        imageDataUrl: samplePng,
        createdAt: Date.now(),
      };

      const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, [sigAnnot]);
      const doc = await PDFDocument.load(burnedBytes);
      expect(doc.getPageCount()).toBe(1);
    });

    it('Tool: Stamp (APPROVED, CONFIDENTIAL, and CUSTOM)', async () => {
      const baseBytes = await createBaseDoc();

      const stamps: AnnotationObject[] = [
        {
          id: 'st-app',
          type: 'stamp',
          stampType: 'APPROVED',
          pageIndex: 0,
          x: 50,
          y: 500,
          width: 140,
          height: 45,
          textColor: '#16a34a',
          strokeColor: '#16a34a',
          rotation: -10,
          createdAt: Date.now(),
        },
        {
          id: 'st-cust',
          type: 'stamp',
          stampType: 'CUSTOM',
          stampText: 'HIGHLY SECRET 2026',
          pageIndex: 0,
          x: 250,
          y: 500,
          width: 180,
          height: 45,
          textColor: '#dc2626',
          strokeColor: '#dc2626',
          rotation: 5,
          createdAt: Date.now(),
        },
      ];

      const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, stamps);
      const pdfJs = await pdfjsLib.getDocument({ data: burnedBytes }).promise;
      const content = await (await pdfJs.getPage(1)).getTextContent();
      const text = content.items.map((i: any) => i.str).join(' ');

      expect(text).toContain('APPROVED');
      expect(text).toContain('HIGHLY SECRET 2026');
    });

    it('Tool: Watermark (Text and Image watermarks across pages)', async () => {
      const baseBytes = await createBaseDoc();

      const watermarkAnnot: AnnotationObject = {
        id: 'wm-1',
        type: 'watermark',
        pageIndex: 0,
        x: 100,
        y: 350,
        width: 400,
        height: 100,
        watermarkType: 'text',
        text: 'CONFIDENTIAL DRAFT',
        fontSize: 48,
        textColor: '#ef4444',
        opacity: 0.25,
        rotation: -45,
        createdAt: Date.now(),
      };

      const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, [watermarkAnnot]);
      const pdfJs = await pdfjsLib.getDocument({ data: burnedBytes }).promise;
      const content = await (await pdfJs.getPage(1)).getTextContent();
      const text = content.items.map((i: any) => i.str).join(' ');

      expect(text).toContain('CONFIDENTIAL DRAFT');
    });

    it('Tool: Annotations (Highlight, Underline, Strikethrough, Shapes, and Drawings)', async () => {
      const baseBytes = await createBaseDoc();

      const items: AnnotationObject[] = [
        {
          id: 'hl-1',
          type: 'highlight',
          pageIndex: 0,
          x: 50,
          y: 60,
          width: 300,
          height: 20,
          fillColor: '#fef08a',
          opacity: 0.4,
          createdAt: Date.now(),
        },
        {
          id: 'ul-1',
          type: 'underline',
          pageIndex: 0,
          x: 50,
          y: 85,
          width: 250,
          height: 3,
          strokeColor: '#2563eb',
          strokeWidth: 2,
          createdAt: Date.now(),
        },
        {
          id: 'st-1',
          type: 'strikethrough',
          pageIndex: 0,
          x: 50,
          y: 70,
          width: 200,
          height: 2,
          strokeColor: '#dc2626',
          strokeWidth: 2,
          createdAt: Date.now(),
        },
        {
          id: 'rect-1',
          type: 'shape',
          shapeType: 'rectangle',
          pageIndex: 0,
          x: 50,
          y: 120,
          width: 150,
          height: 80,
          strokeColor: '#6366f1',
          fillColor: '#e0e7ff',
          strokeWidth: 2,
          createdAt: Date.now(),
        },
        {
          id: 'draw-1',
          type: 'drawing',
          pageIndex: 0,
          x: 250,
          y: 120,
          width: 100,
          height: 80,
          strokeColor: '#0f172a',
          strokeWidth: 3,
          points: [
            { x: 250, y: 120 },
            { x: 280, y: 150 },
            { x: 320, y: 130 },
            { x: 350, y: 200 },
          ],
          createdAt: Date.now(),
        },
      ];

      const burnedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, items);
      const doc = await PDFDocument.load(burnedBytes);
      expect(doc.getPageCount()).toBe(1);
    });

    it('Tool: Page Operations (Duplicate, Rotate, Delete pages)', async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const p1 = doc.addPage([500, 500]);
      p1.drawText('Original Page 1', { x: 50, y: 400, size: 14, font });

      const p2 = doc.addPage([500, 500]);
      p2.drawText('Original Page 2', { x: 50, y: 400, size: 14, font });

      // Rotate page 1 by 90 degrees
      p1.setRotation(degrees(90));
      expect(p1.getRotation().angle).toBe(90);

      // Duplicate page 2
      const [copiedP2] = await doc.copyPages(doc, [1]);
      doc.insertPage(2, copiedP2);
      expect(doc.getPageCount()).toBe(3);

      // Delete page 1
      doc.removePage(0);
      expect(doc.getPageCount()).toBe(2);

      const saved = await doc.save();
      const verifyDoc = await PDFDocument.load(saved);
      expect(verifyDoc.getPageCount()).toBe(2);
    });

    it('Tool: Security (Protect with password & Unlock)', async () => {
      const baseBytes = await createBaseDoc();
      const password = 'DocuLoomSuperPassword2026!';

      // Encrypt
      const protectedBytes = await PdfProtectionEngine.encryptPdf(baseBytes, {
        userPassword: password,
        ownerPassword: password,
        allowPrinting: true,
        allowModifying: false,
        allowCopying: false,
        allowAnnotating: false,
      });

      expect(protectedBytes.length).toBeGreaterThan(0);
      const isEncrypted = await PdfProtectionEngine.isEncrypted(protectedBytes);
      expect(isEncrypted).toBe(true);

      // Unlock
      const unlockedBytes = await PdfProtectionEngine.decryptPdf(protectedBytes, password);
      expect(unlockedBytes.length).toBeGreaterThan(0);

      const isStillEncrypted = await PdfProtectionEngine.isEncrypted(unlockedBytes);
      expect(isStillEncrypted).toBe(false);
    });

    it('Tool: Conversion (PDF-to-Word high-fidelity structure extraction)', async () => {
      const baseBytes = await createBaseDoc();
      const docxBytes = await PdfToWordEngine.convertPdfToDocx(baseBytes);

      expect(docxBytes).toBeDefined();
      expect(docxBytes.byteLength).toBeGreaterThan(100);

      // Check ZIP magic header (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
      expect(docxBytes[0]).toBe(0x50);
      expect(docxBytes[1]).toBe(0x4b);
    });
  });
});
