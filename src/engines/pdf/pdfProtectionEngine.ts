import { encryptPDF, type EncryptPDFOptions } from '@pdfsmaller/pdf-encrypt';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

export interface ProtectionOptions {
  userPassword: string;
  ownerPassword?: string;
  algorithm?: 'AES-256' | 'RC4';
  allowPrinting?: boolean;
  allowModifying?: boolean;
  allowCopying?: boolean;
  allowAnnotating?: boolean;
  allowFillingForms?: boolean;
}

export class PdfProtectionEngine {
  /**
   * Encrypts a PDF binary client-side with standard PDF password protection (AES-256 or RC4 128-bit).
   */
  static async protectPdf(
    pdfBytes: Uint8Array,
    options: ProtectionOptions
  ): Promise<Uint8Array> {
    if (!options.userPassword || options.userPassword.trim() === '') {
      throw new Error('Please enter a password to protect the document.');
    }

    let algo: 'AES-256' | 'RC4' = 'AES-256';
    if (options.algorithm === 'RC4' || (options.algorithm as string) === 'RC4-128') {
      algo = 'RC4';
    }

    const encryptOptions: EncryptPDFOptions = {
      ownerPassword: options.ownerPassword || options.userPassword,
      algorithm: algo,
      allowPrinting: options.allowPrinting ?? true,
      allowModifying: options.allowModifying ?? false,
      allowCopying: options.allowCopying ?? true,
      allowAnnotating: options.allowAnnotating ?? false,
      allowFillingForms: options.allowFillingForms ?? true,
    };

    return await encryptPDF(pdfBytes, options.userPassword, encryptOptions);
  }

  /**
   * Alias for protectPdf.
   */
  static async encryptPdf(
    pdfBytes: Uint8Array,
    options: ProtectionOptions
  ): Promise<Uint8Array> {
    return await this.protectPdf(pdfBytes, options);
  }

  /**
   * Verifies if a PDF is encrypted.
   */
  static async isPdfEncrypted(pdfBytes: Uint8Array): Promise<boolean> {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      await loadingTask.promise;
      return false;
    } catch (err: any) {
      if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
        return true;
      }
      return false;
    }
  }

  /**
   * Alias for isPdfEncrypted.
   */
  static async isEncrypted(pdfBytes: Uint8Array): Promise<boolean> {
    return await this.isPdfEncrypted(pdfBytes);
  }

  /**
   * Unlocks and permanently decrypts an encrypted PDF client-side using the provided password.
   */
  static async unlockPdf(
    pdfBytes: Uint8Array,
    password?: string
  ): Promise<Uint8Array> {
    // 1. Validate password and decrypt page streams via pdfjsLib
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(0),
      password: password || '',
    });

    let pdfJsDoc: pdfjsLib.PDFDocumentProxy;
    try {
      pdfJsDoc = await loadingTask.promise;
    } catch (err: any) {
      if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
        throw new Error('Incorrect password. Please verify the password and try again.');
      }
      throw err;
    }

    // 2. Try loading with pdf-lib directly (e.g. if only owner password / permission restricted)
    try {
      const directDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const cleanDoc = await PDFDocument.create();
      const copiedPages = await cleanDoc.copyPages(directDoc, directDoc.getPageIndices());
      for (const page of copiedPages) {
        cleanDoc.addPage(page);
      }
      return await cleanDoc.save();
    } catch {
      // 3. If direct stream copy fails due to cipher streams, reconstruct high-fidelity vector/raster pages
      const numPages = pdfJsDoc.numPages;
      const cleanDoc = await PDFDocument.create();

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfJsDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High DPI 144 DPI
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const embeddedImg = await cleanDoc.embedJpg(imgDataUrl);

        const newPage = cleanDoc.addPage([unscaledViewport.width, unscaledViewport.height]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        });

        canvas.width = 0;
        canvas.height = 0;
      }

      return await cleanDoc.save();
    }
  }

  /**
   * Alias for unlockPdf.
   */
  static async decryptPdf(
    pdfBytes: Uint8Array,
    password?: string
  ): Promise<Uint8Array> {
    return await this.unlockPdf(pdfBytes, password);
  }
}
