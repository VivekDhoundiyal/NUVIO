import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';

describe('PdfProtectionEngine — Client-Side Encryption & Decryption', () => {
  async function createTestPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Confidential Top Secret Data', {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    return await doc.save();
  }

  it('detects unencrypted PDF as not encrypted', async () => {
    const unencrypted = await createTestPdf();
    const isEnc = await PdfProtectionEngine.isPdfEncrypted(unencrypted);
    expect(isEnc).toBe(false);
  });

  it('encrypts PDF with user password and AES-256 algorithm', async () => {
    const original = await createTestPdf();
    const password = 'SuperSecretPassword123!';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword: password,
      algorithm: 'AES-256',
      allowPrinting: true,
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
    });

    expect(encrypted.length).toBeGreaterThan(0);
    // Ensure encrypted document is recognized as encrypted
    const isEnc = await PdfProtectionEngine.isPdfEncrypted(encrypted);
    expect(isEnc).toBe(true);
  });

  it('decrypts encrypted PDF using correct password', async () => {
    const original = await createTestPdf();
    const password = 'DecryptionKey2026';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword: password,
      algorithm: 'AES-256',
    });

    const decrypted = await PdfProtectionEngine.unlockPdf(encrypted, password);
    expect(decrypted.length).toBeGreaterThan(0);

    // Decrypted bytes should open cleanly with standard PDFDocument
    const openedDoc = await PDFDocument.load(decrypted);
    expect(openedDoc.getPageCount()).toBe(1);
  });

  it('fails decryption when provided with incorrect password', async () => {
    const original = await createTestPdf();
    const password = 'CorrectPassword';

    const encrypted = await PdfProtectionEngine.protectPdf(original, {
      userPassword: password,
      algorithm: 'AES-256',
    });

    await expect(
      PdfProtectionEngine.unlockPdf(encrypted, 'WrongPassword')
    ).rejects.toThrow();
  });
});
