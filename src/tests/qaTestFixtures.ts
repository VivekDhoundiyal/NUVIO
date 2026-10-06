import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';

export class QaTestFixtures {
  /**
   * 1. Single Page PDF with standard typography, heading, and body paragraphs.
   */
  static async createSinglePagePdf(customText = 'DocuLoom Single Page Standard Document'): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]); // A4
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText(customText, {
      x: 50,
      y: 780,
      size: 20,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });

    page.drawText('This document is generated for automated quality assurance and verification.', {
      x: 50,
      y: 750,
      size: 11,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    });

    page.drawRectangle({
      x: 50,
      y: 735,
      width: 495.28,
      height: 1.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    const bodyText = [
      'DocuLoom processes documents entirely client-side using WebAssembly and Web Workers.',
      'Untouched streams, fonts, vectors, and layouts remain bit-for-bit identical during editing.',
      'All security features, including AES-256 encryption, execute locally without third-party APIs.',
    ];

    let currentY = 700;
    for (const paragraph of bodyText) {
      page.drawText(paragraph, {
        x: 50,
        y: currentY,
        size: 11,
        font: fontRegular,
        color: rgb(0.15, 0.2, 0.3),
      });
      currentY -= 30;
    }

    return await doc.save();
  }

  /**
   * 2. Multi-page document (10+ pages) with page numbering and tables.
   */
  static async createMultiPagePdf(count = 10): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < count; i++) {
      const page = doc.addPage([595.28, 841.89]);
      const pageNum = i + 1;

      // Header
      page.drawText(`Document Report — Section ${pageNum}`, {
        x: 50,
        y: 800,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      // Body lines
      for (let line = 0; line < 15; line++) {
        page.drawText(`Sample item #${line + 1} on page ${pageNum}: Verified local processing metric`, {
          x: 50,
          y: 750 - line * 28,
          size: 10,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.35),
        });
      }

      // Footer
      page.drawText(`Page ${pageNum} of ${count}`, {
        x: 270,
        y: 40,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.65),
      });
    }

    return await doc.save();
  }

  /**
   * 3. Large document (100+ pages) for streaming and high-capacity boundary tests.
   */
  static async createLargeScalePdf(count = 105): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < count; i++) {
      const page = doc.addPage([612, 792]); // Letter
      page.drawText(`High-Scale Page Index #${i + 1}`, {
        x: 60,
        y: 720,
        size: 16,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(`Automated boundary test payload byte-hash verify ${i + 1}`, {
        x: 60,
        y: 690,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    return await doc.save();
  }

  /**
   * 4. Multilingual & Unicode text document.
   */
  static async createMultilingualPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    // Standard Latin + European accents + encoded representation
    page.drawText('Multilingual Verification: English, Français, Español, Deutsch', {
      x: 50,
      y: 780,
      size: 13,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText('Accented: Café, Naïve, Über, Résumé, Coöperation, Señor, Ångström', {
      x: 50,
      y: 740,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.3),
    });

    page.drawText('Devanagari Unicode: Namaste India (DocuLoom Universal)', {
      x: 50,
      y: 700,
      size: 11,
      font,
      color: rgb(0.2, 0.4, 0.2),
    });

    page.drawText('Arabic & RTL Representation: Salam DocuLoom Privacy First', {
      x: 50,
      y: 660,
      size: 11,
      font,
      color: rgb(0.4, 0.2, 0.2),
    });

    return await doc.save();
  }

  /**
   * 5. Document with rotated pages (0°, 90°, 180°, 270°).
   */
  static async createRotatedPagesPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    const rotations = [0, 90, 180, 270];
    for (let i = 0; i < rotations.length; i++) {
      const rot = rotations[i];
      const page = doc.addPage([595.28, 841.89]);
      page.setRotation(degrees(rot));

      page.drawText(`Page ${i + 1} with native ${rot} degree rotation`, {
        x: 60,
        y: 700,
        size: 14,
        font,
        color: rgb(0.1, 0.2, 0.4),
      });
    }

    return await doc.save();
  }

  /**
   * 6. Scanned image PDF (contains embedded PNG/JPG bitmap simulating document scan).
   */
  static async createScannedImagePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);

    // 1x1 transparent/white pixel or small PNG bytes
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const imageBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const embeddedImg = await doc.embedPng(imageBytes);

    // Draw image covering page to simulate full-bleed scanned document
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
    });

    return await doc.save();
  }

  /**
   * 7. Interactive AcroForm PDF (Text fields, checkboxes).
   */
  static async createAcroFormPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const form = doc.getForm();

    page.drawText('DocuLoom Interactive AcroForm Test', {
      x: 50,
      y: 780,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText('Full Name:', { x: 50, y: 720, size: 11, font });
    const nameField = form.createTextField('FullName');
    nameField.setText('Jane Doe');
    nameField.addToPage(page, { x: 140, y: 710, width: 250, height: 22 });

    page.drawText('Email Address:', { x: 50, y: 670, size: 11, font });
    const emailField = form.createTextField('Email');
    emailField.setText('jane.doe@example.com');
    emailField.addToPage(page, { x: 140, y: 660, width: 250, height: 22 });

    page.drawText('Accept Local Terms:', { x: 50, y: 620, size: 11, font });
    const checkField = form.createCheckBox('AcceptTerms');
    checkField.check();
    checkField.addToPage(page, { x: 180, y: 615, width: 18, height: 18 });

    return await doc.save();
  }

  /**
   * 8. AES-256 standard encrypted PDF.
   */
  static async createEncryptedPdf(password = 'SecretPass123'): Promise<Uint8Array> {
    const rawPdf = await this.createSinglePagePdf('Classified Confidential Document');
    return await PdfProtectionEngine.encryptPdf(rawPdf, {
      userPassword: password,
      algorithm: 'AES-256',
    });
  }

  /**
   * 9. Minimal valid PNG Data URL for image watermark and conversion testing.
   */
  static async createTestPngDataUrl(): Promise<string> {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  }
}
