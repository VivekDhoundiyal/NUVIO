import { PDFDocument } from 'pdf-lib';
import type { PDFTextElement, TextWordItem } from '../../types/document';
import { PdfFontResolver } from './pdfFontResolver';
import { PdfContentParser } from './pdfContentParser';
import { PdfContentStreamPatcher } from './pdfContentStreamPatcher';
import type { PdfGlyph, PdfTextRun } from './pdfTextObjectModel';

export class PdfDocumentModel {
  /**
   * Extracts canonical PDFTextElements directly from the page's PostScript content streams.
   * Every extracted element is permanently bound to its exact sourceOperatorReference
   * (streamIndex, opIndex, operandIndex), guaranteeing that any mutation in the editor
   * maps with 100% determinism to the exact PostScript operator in the PDF binary.
   */
  public static async extractPageElements(
    pdfDoc: PDFDocument,
    pageIndex: number,
    existingResolver?: PdfFontResolver
  ): Promise<{ elements: PDFTextElement[]; fontResolver: PdfFontResolver; isScanned: boolean }> {
    const pages = pdfDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) {
      return { elements: [], fontResolver: existingResolver || new PdfFontResolver(), isScanned: false };
    }

    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();

    const fontResolver = existingResolver || new PdfFontResolver();
    await fontResolver.loadPageFonts(pdfDoc, page);

    const { streamRefs, streamTexts } = PdfContentStreamPatcher.getPageStreams(pdfDoc, page);
    if (streamRefs.length === 0) {
      return { elements: [], fontResolver, isScanned: true };
    }

    const elements: PDFTextElement[] = [];
    let totalGlyphCount = 0;

    for (let sIdx = 0; sIdx < streamTexts.length; sIdx++) {
      const streamText = streamTexts[sIdx];
      if (!streamText || streamText.trim() === '') continue;

      const tokens = PdfContentParser.tokenize(streamText);
      const operations = PdfContentParser.parseOperations(tokens);
      const textObjects = PdfContentParser.extractTextObjects(operations, fontResolver, sIdx, pageIndex);

      for (const txtObj of textObjects) {
        for (const run of txtObj.runs) {
          if (!run.text || run.text.trim() === '') continue;

          totalGlyphCount += run.glyphs.length;
          const element = this.buildElementFromRun(run, pageIndex, pageHeight, fontResolver);
          elements.push(element);
        }
      }
    }

    const isScanned = totalGlyphCount === 0;
    return { elements, fontResolver, isScanned };
  }

  /**
   * Converts a PostScript content-stream PdfTextRun into a canonical PDFTextElement.
   */
  private static buildElementFromRun(
    run: PdfTextRun,
    pageIndex: number,
    pageHeight: number,
    fontResolver: PdfFontResolver
  ): PDFTextElement {
    const meta = fontResolver.getFontMetadata(run.fontResource);
    const baseFont = meta?.baseFont || run.fontResource;
    const lowerFont = baseFont.toLowerCase();

    const isBold =
      lowerFont.includes('bold') ||
      lowerFont.includes('black') ||
      lowerFont.includes('heavy') ||
      lowerFont.includes('semibold') ||
      lowerFont.includes('700') ||
      lowerFont.includes('800');

    const isItalic =
      lowerFont.includes('italic') ||
      lowerFont.includes('oblique') ||
      lowerFont.includes('slant');

    let resolvedFamily = 'Helvetica, Arial, sans-serif';
    if (lowerFont.includes('times') || lowerFont.includes('serif') || lowerFont.includes('roman')) {
      resolvedFamily = 'Times New Roman, Times, serif';
    } else if (lowerFont.includes('courier') || lowerFont.includes('mono') || lowerFont.includes('consolas')) {
      resolvedFamily = 'Courier New, Courier, monospace';
    } else if (lowerFont.includes('georgia')) {
      resolvedFamily = 'Georgia, serif';
    } else if (lowerFont.includes('garamond')) {
      resolvedFamily = 'Garamond, serif';
    } else if (lowerFont.includes('calibri')) {
      resolvedFamily = 'Calibri, Helvetica, sans-serif';
    } else if (lowerFont.includes('verdana')) {
      resolvedFamily = 'Verdana, sans-serif';
    }

    // Convert colors to hex
    const r = Math.round(Math.min(1, Math.max(0, run.fillColor.r)) * 255);
    const g = Math.round(Math.min(1, Math.max(0, run.fillColor.g)) * 255);
    const b = Math.round(Math.min(1, Math.max(0, run.fillColor.b)) * 255);
    const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    // PDF User coordinates: origin bottom-left
    const pdfX = Math.round(run.x * 100) / 100;
    const pdfY = Math.round(run.y * 100) / 100;
    const width = Math.max(10, Math.round(run.width * 100) / 100);
    const height = Math.max(run.fontSize, Math.round(run.height * 100) / 100);

    // Viewport coordinates: origin top-left
    const viewportY = Math.round((pageHeight - pdfY - height) * 100) / 100;

    const id = `el-${pageIndex}-${run.streamIndex}-${run.opIndex}-${run.operandIndex}`;

    // Tokenize discrete words from the run's glyphs
    const words = this.tokenizeRunIntoWords(run, id, pageIndex, pageHeight, hexColor, resolvedFamily, isBold, isItalic);

    return {
      id,
      pageIndex,
      originalText: run.text,
      currentText: run.text,
      originalFont: run.fontResource,
      resolvedFont: baseFont,
      embeddedFontReference: meta?.isSubset ? meta.subsetPrefix : undefined,
      fontSize: run.fontSize,
      originalFontSize: run.fontSize,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      fillColor: hexColor,
      color: hexColor,
      originalColor: hexColor,
      rgbColor: { ...run.fillColor },
      characterSpacing: run.graphicsState.charSpacing,
      wordSpacing: run.graphicsState.wordSpacing,
      horizontalScale: run.graphicsState.horizontalScale,
      lineHeight: run.graphicsState.leading || run.fontSize * 1.2,
      x: pdfX,
      y: Math.max(0, viewportY), // top-left for UI backwards compatibility
      pdfX,
      pdfY,
      width,
      height,
      baseline: pdfY,
      rotation: 0,
      textMatrix: [...run.graphicsState.tm],
      transformMatrix: [...run.graphicsState.tm],
      renderingMode: run.graphicsState.renderMode,
      originalBoundingBox: { x: pdfX, y: pdfY, width, height },
      currentBoundingBox: { x: pdfX, y: pdfY, width, height },
      sourceOperatorReference: {
        streamIndex: run.streamIndex,
        opIndex: run.opIndex,
        operandIndex: run.operandIndex,
      },
      sourceTextItemReference: id,
      isModified: false,
      glyphs: run.glyphs,
      words,
      fontFamily: resolvedFamily,
      pdfFontName: baseFont,
      fontResourceName: run.fontResource,
      streamIndex: run.streamIndex,
      opIndex: run.opIndex,
    };
  }

  /**
   * Tokenizes a PdfTextRun into discrete hit-testable TextWordItems
   * based on its underlying glyph positions.
   */
  private static tokenizeRunIntoWords(
    run: PdfTextRun,
    elementId: string,
    pageIndex: number,
    pageHeight: number,
    color: string,
    fontFamily: string,
    isBold: boolean,
    isItalic: boolean
  ): TextWordItem[] {
    const words: TextWordItem[] = [];
    const glyphs = run.glyphs;
    if (glyphs.length === 0) return words;

    let currentChars: string[] = [];
    let currentStartGlyph: PdfGlyph | null = null;
    let currentEndGlyph: PdfGlyph | null = null;
    let wordIdx = 0;

    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      const isSpace = g.char === ' ' || g.char === '\t' || g.char === '\r' || g.char === '\n';

      if (!isSpace) {
        if (!currentStartGlyph) {
          currentStartGlyph = g;
        }
        currentEndGlyph = g;
        currentChars.push(g.char);
      } else {
        if (currentStartGlyph && currentEndGlyph && currentChars.length > 0) {
          words.push(
            this.createWordItem(
              elementId,
              wordIdx++,
              pageIndex,
              pageHeight,
              currentChars.join(''),
              currentStartGlyph,
              currentEndGlyph,
              run,
              color,
              fontFamily,
              isBold,
              isItalic
            )
          );
          currentStartGlyph = null;
          currentEndGlyph = null;
          currentChars = [];
        }
      }
    }

    if (currentStartGlyph && currentEndGlyph && currentChars.length > 0) {
      words.push(
        this.createWordItem(
          elementId,
          wordIdx++,
          pageIndex,
          pageHeight,
          currentChars.join(''),
          currentStartGlyph,
          currentEndGlyph,
          run,
          color,
          fontFamily,
          isBold,
          isItalic
        )
      );
    }

    return words;
  }

  private static createWordItem(
    elementId: string,
    wordIdx: number,
    pageIndex: number,
    pageHeight: number,
    text: string,
    startGlyph: PdfGlyph,
    endGlyph: PdfGlyph,
    run: PdfTextRun,
    color: string,
    fontFamily: string,
    isBold: boolean,
    isItalic: boolean
  ): TextWordItem {
    const pdfX = Math.round(startGlyph.x * 10) / 10;
    const pdfY = Math.round(startGlyph.y * 10) / 10;
    const wordWidth = Math.max(8, Math.round((endGlyph.x + endGlyph.width - startGlyph.x) * 10) / 10);
    const wordHeight = Math.max(run.fontSize, Math.round(run.height * 10) / 10);
    const viewportY = Math.round((pageHeight - pdfY - wordHeight) * 10) / 10;

    return {
      id: `${elementId}-w${wordIdx}`,
      spanId: elementId,
      pageIndex,
      text,
      originalText: text,
      x: pdfX,
      y: Math.max(0, viewportY),
      pdfX,
      pdfY,
      width: wordWidth,
      height: wordHeight,
      baseline: pdfY,
      fontSize: run.fontSize,
      fontFamily,
      pdfFontName: run.fontResource,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      color,
      rgbColor: { ...run.fillColor },
      isModified: false,
      streamIndex: run.streamIndex,
      opIndex: run.opIndex,
      fontResourceName: run.fontResource,
      rawTextMatrix: [...run.graphicsState.tm],
      rawOperandType: run.isHexString ? 'hex' : 'literal',
    };
  }
}
