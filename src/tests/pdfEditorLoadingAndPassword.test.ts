import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfEngine, isPasswordException, formatPdfErrorMessage } from '../engines/pdf/pdfEngine';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';

describe('PDF Editor Loading & Password Handling', () => {
  async function createSamplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Nuvio PDF Editor Document Test', {
      x: 50,
      y: 750,
      size: 18,
      font,
      color: rgb(0.1, 0.2, 0.4),
    });
    return await doc.save();
  }

  it('reliably loads standard unencrypted PDF without password prompt', async () => {
    const pdfBytes = await createSamplePdf();
    const info = await PdfEngine.getPdfInfo(pdfBytes, 'test.pdf');
    expect(info.pageCount).toBe(1);
    expect(info.pages.length).toBe(1);

    const docProxy = await PdfEngine.loadPdfJsDoc(pdfBytes);
    expect(docProxy.numPages).toBe(1);

    const spans = await PdfEngine.extractPageTextSpans(docProxy, 1);
    expect(spans.textSpans.length).toBeGreaterThan(0);
    expect(spans.textSpans.some((s) => s.originalText.includes('Nuvio'))).toBe(true);
  });

  it('correctly detects password protected PDF and identifies PasswordException', async () => {
    const original = await createSamplePdf();
    const userPassword = 'EditorPassword99!';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword,
      algorithm: 'AES-256',
    });

    // Attempting to load without password should throw a PasswordException
    let caughtErr: any = null;
    try {
      await PdfEngine.loadPdfJsDoc(encrypted);
    } catch (err: any) {
      caughtErr = err;
    }

    expect(caughtErr).not.toBeNull();
    expect(isPasswordException(caughtErr)).toBe(true);
    expect(PdfEngine.isPasswordException(caughtErr)).toBe(true);

    const userMsg = formatPdfErrorMessage(caughtErr);
    expect(userMsg).toContain('password');
  });

  it('unlocks password-protected PDF directly using password in PdfEngine', async () => {
    const original = await createSamplePdf();
    const userPassword = 'SecretPasscode2026';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword,
      algorithm: 'AES-256',
    });

    // Opening with password should succeed
    const docProxy = await PdfEngine.loadPdfJsDoc(encrypted, userPassword);
    expect(docProxy.numPages).toBe(1);

    const info = await PdfEngine.getPdfInfo(encrypted, 'doc.pdf', userPassword);
    expect(info.pageCount).toBe(1);

    const spans = await PdfEngine.extractPageTextSpans(docProxy, 1);
    expect(spans.textSpans.length).toBeGreaterThan(0);
    expect(spans.textSpans.some((s) => s.originalText.includes('Nuvio'))).toBe(true);
  });

  it('rejects unlocking with wrong password', async () => {
    const original = await createSamplePdf();
    const userPassword = 'MySecretPassword';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword,
      algorithm: 'AES-256',
    });

    await expect(
      PdfEngine.loadPdfJsDoc(encrypted, 'WrongPassword123')
    ).rejects.toThrow();
  });

  it('handles empty password and edge cases in isPasswordException helper', () => {
    expect(isPasswordException(null)).toBe(false);
    expect(isPasswordException(undefined)).toBe(false);
    expect(isPasswordException(new Error('Network error'))).toBe(false);
    expect(isPasswordException({ name: 'PasswordException', code: 1 })).toBe(true);
    expect(isPasswordException({ name: 'PasswordException', code: 2 })).toBe(true);
    expect(isPasswordException(new Error('No password given'))).toBe(true);
    expect(isPasswordException(new Error('Password required'))).toBe(true);
    expect(isPasswordException(new Error('Incorrect password'))).toBe(true);
  });
});
