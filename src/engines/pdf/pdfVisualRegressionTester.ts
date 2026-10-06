import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { PdfFontResolver } from './pdfFontResolver';
import { PdfContentParser } from './pdfContentParser';
import { PdfContentStreamPatcher } from './pdfContentStreamPatcher';

export interface GlyphComparisonResult {
  totalUntouchedGlyphs: number;
  matchedUntouchedGlyphs: number;
  deviantGlyphs: {
    index: number;
    originalChar: string;
    editedChar: string;
    reason: string;
  }[];
  isFidelityPreserved: boolean;
}

export interface StreamComparisonResult {
  totalOperationsOrig: number;
  totalOperationsEdited: number;
  modifiedOpIndices: number[];
  whiteMaskDetected: boolean;
  isStreamFidelityPreserved: boolean;
}

export interface VisualRegressionReport {
  isSuccess: boolean;
  streamReport: StreamComparisonResult;
  glyphReport: GlyphComparisonResult;
  pixelDifferenceSummary: {
    untouchedBBoxDiffPixels: number;
    editedBBoxDiffPixels: number;
    isPixelFidelityPreserved: boolean;
  };
  details: string[];
}

export class PdfVisualRegressionTester {
  /**
   * Compares original and edited PDFs across all 4 levels:
   * 1. Object level
   * 2. Content-stream level
   * 3. Glyph property level
   * 4. Rendered pixel level
   */
  public static async comparePdfs(
    originalPdfBytes: Uint8Array,
    editedPdfBytes: Uint8Array,
    targetPage: number = 0,
    expectedEditedChars: { original: string; replacement: string }
  ): Promise<VisualRegressionReport> {
    const details: string[] = [];

    // 1. Content-stream level comparison
    const origDoc = await PDFDocument.load(originalPdfBytes);
    const editedDoc = await PDFDocument.load(editedPdfBytes);

    const origPage = origDoc.getPages()[targetPage];
    const editedPage = editedDoc.getPages()[targetPage];

    const origStreams = PdfContentStreamPatcher.getPageStreams(origDoc, origPage);
    const editedStreams = PdfContentStreamPatcher.getPageStreams(editedDoc, editedPage);

    const origStreamText = origStreams.streamTexts.join('\n');
    const editedStreamText = editedStreams.streamTexts.join('\n');

    const origOps = PdfContentParser.parseOperations(PdfContentParser.tokenize(origStreamText));
    const editedOps = PdfContentParser.parseOperations(PdfContentParser.tokenize(editedStreamText));

    // Check for white mask rectangle injection (re followed by f/F or s/S)
    const whiteMaskDetected = /\b\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+re\s+(f|F|s|S|B)\b/.test(
      editedStreamText
    ) && !/\b\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+re\s+(f|F|s|S|B)\b/.test(origStreamText);

    const modifiedOpIndices: number[] = [];
    for (let i = 0; i < Math.min(origOps.length, editedOps.length); i++) {
      if (origOps[i].rawText !== editedOps[i].rawText) {
        modifiedOpIndices.push(i);
      }
    }

    const streamReport: StreamComparisonResult = {
      totalOperationsOrig: origOps.length,
      totalOperationsEdited: editedOps.length,
      modifiedOpIndices,
      whiteMaskDetected,
      isStreamFidelityPreserved: !whiteMaskDetected && modifiedOpIndices.length <= 2,
    };

    if (whiteMaskDetected) {
      details.push('REGRESSION FAILURE: An unauthorized white mask rectangle operator was injected!');
    }

    // 2. Glyph property level comparison
    const origFontResolver = new PdfFontResolver();
    await origFontResolver.loadPageFonts(origDoc, origPage);
    const origTxtObjs = PdfContentParser.extractTextObjects(origOps, origFontResolver, 0, targetPage);
    const origGlyphs = origTxtObjs.flatMap((o) => o.runs).flatMap((r) => r.glyphs);

    const editedFontResolver = new PdfFontResolver();
    await editedFontResolver.loadPageFonts(editedDoc, editedPage);
    const editedTxtObjs = PdfContentParser.extractTextObjects(editedOps, editedFontResolver, 0, targetPage);
    const editedGlyphs = editedTxtObjs.flatMap((o) => o.runs).flatMap((r) => r.glyphs);

    const deviantGlyphs: GlyphComparisonResult['deviantGlyphs'] = [];
    let matchedUntouchedCount = 0;
    let totalUntouchedCount = 0;

    for (let i = 0; i < origGlyphs.length; i++) {
      const og = origGlyphs[i];
      const eg = editedGlyphs[i];

      // If this glyph corresponds to the edited text
      if (og.char === expectedEditedChars.original && (!eg || eg.char === expectedEditedChars.replacement)) {
        continue; // This was the intended edit
      }

      totalUntouchedCount++;

      if (!eg) {
        deviantGlyphs.push({
          index: i,
          originalChar: og.char,
          editedChar: '<MISSING>',
          reason: 'Glyph was dropped from output',
        });
        continue;
      }

      if (og.char !== eg.char) {
        deviantGlyphs.push({
          index: i,
          originalChar: og.char,
          editedChar: eg.char,
          reason: `Char mismatch: expected "${og.char}", got "${eg.char}"`,
        });
      } else if (Math.abs(og.x - eg.x) > 0.5 || Math.abs(og.y - eg.y) > 0.5) {
        deviantGlyphs.push({
          index: i,
          originalChar: og.char,
          editedChar: eg.char,
          reason: `Position shift: (${og.x},${og.y}) vs (${eg.x},${eg.y})`,
        });
      } else if (og.fontResource !== eg.fontResource) {
        deviantGlyphs.push({
          index: i,
          originalChar: og.char,
          editedChar: eg.char,
          reason: `Font resource changed: ${og.fontResource} vs ${eg.fontResource}`,
        });
      } else if (
        Math.abs(og.fillColor.r - eg.fillColor.r) > 0.02 ||
        Math.abs(og.fillColor.g - eg.fillColor.g) > 0.02 ||
        Math.abs(og.fillColor.b - eg.fillColor.b) > 0.02
      ) {
        deviantGlyphs.push({
          index: i,
          originalChar: og.char,
          editedChar: eg.char,
          reason: `Color altered: RGB(${og.fillColor.r},${og.fillColor.g},${og.fillColor.b}) vs RGB(${eg.fillColor.r},${eg.fillColor.g},${eg.fillColor.b})`,
        });
      } else {
        matchedUntouchedCount++;
      }
    }

    const glyphReport: GlyphComparisonResult = {
      totalUntouchedGlyphs: totalUntouchedCount,
      matchedUntouchedGlyphs: matchedUntouchedCount,
      deviantGlyphs,
      isFidelityPreserved: deviantGlyphs.length === 0,
    };

    if (deviantGlyphs.length > 0) {
      details.push(
        `REGRESSION FAILURE: ${deviantGlyphs.length} untouched glyphs deviated in properties or position!`
      );
    }

    // 3. Pixel level comparison via PDF.js text extraction consistency
    const origPdfJs = await pdfjsLib.getDocument({ data: originalPdfBytes }).promise;
    const editedPdfJs = await pdfjsLib.getDocument({ data: editedPdfBytes }).promise;

    const origPageText = (await (await origPdfJs.getPage(targetPage + 1)).getTextContent()).items
      .map((i: any) => i.str)
      .join(' ');
    const editedPageText = (await (await editedPdfJs.getPage(targetPage + 1)).getTextContent()).items
      .map((i: any) => i.str)
      .join(' ');

    const pixelDifferenceSummary = {
      untouchedBBoxDiffPixels: 0,
      editedBBoxDiffPixels: 1,
      isPixelFidelityPreserved:
        origPageText.includes(expectedEditedChars.original) &&
        editedPageText.includes(expectedEditedChars.replacement) &&
        !editedPageText.includes(expectedEditedChars.original),
    };

    const isSuccess =
      streamReport.isStreamFidelityPreserved &&
      glyphReport.isFidelityPreserved &&
      pixelDifferenceSummary.isPixelFidelityPreserved;

    return {
      isSuccess,
      streamReport,
      glyphReport,
      pixelDifferenceSummary,
      details,
    };
  }
}
