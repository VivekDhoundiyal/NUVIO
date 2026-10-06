import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from 'pdf-lib';

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'unknown';

export interface FormFieldInfo {
  name: string;
  type: FormFieldType;
  value: string | boolean | string[];
  currentValue?: string | boolean | string[]; // alias
  options?: string[];
  isReadOnly: boolean;
  isRequired?: boolean;
  isMultiline?: boolean;
}

export class PdfFormEngine {
  /**
   * Alias for extractFormFields.
   */
  static async getFormFields(pdfBytes: Uint8Array): Promise<FormFieldInfo[]> {
    return await this.extractFormFields(pdfBytes);
  }

  /**
   * Extracts all interactive AcroForm fields from a PDF document.
   */
  static async extractFormFields(pdfBytes: Uint8Array): Promise<FormFieldInfo[]> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      return [];
    }

    const fields = form.getFields();
    const result: FormFieldInfo[] = [];

    for (const field of fields) {
      const name = field.getName();
      let type: FormFieldType = 'unknown';
      let value: string | boolean | string[] = '';
      let options: string[] | undefined = undefined;
      let isMultiline = false;
      const isReadOnly = field.isReadOnly();

      if (field instanceof PDFTextField) {
        type = 'text';
        value = field.getText() || '';
        isMultiline = field.isMultiline();
      } else if (field instanceof PDFCheckBox) {
        type = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFRadioGroup) {
        type = 'radio';
        value = field.getSelected() || '';
        options = field.getOptions();
      } else if (field instanceof PDFDropdown) {
        type = 'dropdown';
        const selected = field.getSelected();
        value = selected ? selected[0] || '' : '';
        options = field.getOptions();
      } else if (field instanceof PDFOptionList) {
        type = 'optionlist';
        value = field.getSelected();
        options = field.getOptions();
      }

      result.push({
        name,
        type,
        value,
        currentValue: value,
        options,
        isReadOnly,
        isMultiline,
      });
    }

    return result;
  }

  /**
   * Updates AcroForm field values and exports the completed PDF, with optional flattening.
   */
  static async fillForm(
    pdfBytes: Uint8Array,
    fieldValues: Record<string, string | boolean | string[]>,
    flatten: boolean = false
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    for (const [name, val] of Object.entries(fieldValues)) {
      try {
        const field = form.getFieldMaybe(name);
        if (!field) continue;

        if (field instanceof PDFTextField && typeof val === 'string') {
          field.setText(val);
        } else if (field instanceof PDFCheckBox && typeof val === 'boolean') {
          if (val) {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (field instanceof PDFRadioGroup && typeof val === 'string') {
          if (val) field.select(val);
        } else if (field instanceof PDFDropdown && typeof val === 'string') {
          if (val) field.select(val);
        } else if (field instanceof PDFOptionList && Array.isArray(val)) {
          for (const opt of val) {
            field.select(opt);
          }
        }
      } catch (err) {
        console.warn(`Could not set form field "${name}":`, err);
      }
    }

    if (flatten) {
      form.flatten();
    }

    return await pdfDoc.save();
  }

  /**
   * Flattens interactive form fields into non-editable page content streams.
   */
  static async flattenForm(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    try {
      const form = pdfDoc.getForm();
      form.flatten();
    } catch {
      // No form or already flattened
    }
    return await pdfDoc.save();
  }
}
