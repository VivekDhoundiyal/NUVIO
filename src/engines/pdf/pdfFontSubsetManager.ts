import { PDFDocument, PDFPage, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { FontMetadata } from './pdfFontResolver';

export class PdfFontSubsetManager {
  /**
   * Registers fontkit with the PDFDocument context.
   */
  public static initFontkit(pdfDoc: PDFDocument): void {
    pdfDoc.registerFontkit(fontkit);
  }

  /**
   * Checks if an embedded font program exists and can be reused for missing glyphs.
   * If missing glyphs are needed, embeds a complementary font resource matching the font style.
   */
  public static async resolveOrExtendFont(
    pdfDoc: PDFDocument,
    _page: PDFPage,
    meta: FontMetadata,
    missingChars: string[]
  ): Promise<{ fontResourceName: string; isExtended: boolean }> {
    // If no missing characters, reuse existing font resource
    if (missingChars.length === 0) {
      return { fontResourceName: meta.resourceName, isExtended: false };
    }

    // Try embedding font data from original embedded font program if available
    if (meta.embeddedFontData && meta.embeddedFontData.length > 0) {
      try {
        this.initFontkit(pdfDoc);
        const embeddedCustomFont = await pdfDoc.embedFont(meta.embeddedFontData, { subset: true });
        return {
          fontResourceName: `/${embeddedCustomFont.name}`,
          isExtended: true,
        };
      } catch {
        // Fall through to style-matched fallback
      }
    }

    // Complementary style-matched font embedding:
    // Determine style from baseFont name
    const lower = (meta.baseFont || '').toLowerCase();
    let standardFont = StandardFonts.Helvetica;
    if (lower.includes('times') || lower.includes('serif') || lower.includes('roman')) {
      if (lower.includes('bold') && lower.includes('italic')) standardFont = StandardFonts.TimesRomanBoldItalic;
      else if (lower.includes('bold')) standardFont = StandardFonts.TimesRomanBold;
      else if (lower.includes('italic')) standardFont = StandardFonts.TimesRomanItalic;
      else standardFont = StandardFonts.TimesRoman;
    } else if (lower.includes('courier') || lower.includes('mono')) {
      if (lower.includes('bold') && lower.includes('italic')) standardFont = StandardFonts.CourierBoldOblique;
      else if (lower.includes('bold')) standardFont = StandardFonts.CourierBold;
      else if (lower.includes('italic')) standardFont = StandardFonts.CourierOblique;
      else standardFont = StandardFonts.Courier;
    } else {
      if (lower.includes('bold') && (lower.includes('italic') || lower.includes('oblique'))) standardFont = StandardFonts.HelveticaBoldOblique;
      else if (lower.includes('bold')) standardFont = StandardFonts.HelveticaBold;
      else if (lower.includes('italic') || lower.includes('oblique')) standardFont = StandardFonts.HelveticaOblique;
      else standardFont = StandardFonts.Helvetica;
    }

    const fallbackFont = await pdfDoc.embedFont(standardFont);
    return {
      fontResourceName: `/${fallbackFont.name}`,
      isExtended: true,
    };
  }
}
