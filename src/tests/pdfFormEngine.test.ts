import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfFormEngine } from '../engines/pdf/pdfFormEngine';

describe('PdfFormEngine — Interactive AcroForm Discovery & Filling', () => {
  async function createFormPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    const form = doc.getForm();

    const nameField = form.createTextField('fullName');
    nameField.addToPage(page, { x: 50, y: 400, width: 200, height: 25 });

    const agreeCheck = form.createCheckBox('agreeTerms');
    agreeCheck.addToPage(page, { x: 50, y: 350, width: 20, height: 20 });

    const dropdown = form.createDropdown('country');
    dropdown.addOptions(['United States', 'United Kingdom', 'Canada', 'India', 'Germany']);
    dropdown.addToPage(page, { x: 50, y: 300, width: 180, height: 25 });

    return await doc.save();
  }

  it('discovers all AcroForm fields correctly', async () => {
    const formBytes = await createFormPdf();
    const fields = await PdfFormEngine.extractFormFields(formBytes);

    expect(fields.length).toBe(3);

    const nameField = fields.find((f) => f.name === 'fullName');
    expect(nameField).toBeDefined();
    expect(nameField?.type).toBe('text');

    const checkField = fields.find((f) => f.name === 'agreeTerms');
    expect(checkField).toBeDefined();
    expect(checkField?.type).toBe('checkbox');
    expect(checkField?.value).toBe(false);

    const dropdownField = fields.find((f) => f.name === 'country');
    expect(dropdownField).toBeDefined();
    expect(dropdownField?.type).toBe('dropdown');
    expect(dropdownField?.options).toContain('Canada');
  });

  it('fills form fields interactively', async () => {
    const formBytes = await createFormPdf();
    const filledBytes = await PdfFormEngine.fillForm(
      formBytes,
      {
        fullName: 'Jane Doe',
        agreeTerms: true,
        country: 'Canada',
      },
      false
    );

    const updatedFields = await PdfFormEngine.extractFormFields(filledBytes);
    const nameField = updatedFields.find((f) => f.name === 'fullName');
    expect(nameField?.value).toBe('Jane Doe');

    const checkField = updatedFields.find((f) => f.name === 'agreeTerms');
    expect(checkField?.value).toBe(true);

    const dropdownField = updatedFields.find((f) => f.name === 'country');
    expect(dropdownField?.value).toBe('Canada');
  });

  it('flattens form fields into non-interactive vectors when flatten is true', async () => {
    const formBytes = await createFormPdf();
    const flattenedBytes = await PdfFormEngine.fillForm(
      formBytes,
      {
        fullName: 'Jane Doe',
        agreeTerms: true,
      },
      true // flatten
    );

    // After flattening, interactive fields should be 0
    const remainingFields = await PdfFormEngine.extractFormFields(flattenedBytes);
    expect(remainingFields.length).toBe(0);
  });
});
