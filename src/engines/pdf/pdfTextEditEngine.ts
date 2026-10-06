import type { PdfGlyph, PdfTextRun } from './pdfTextObjectModel';
import { PdfFontResolver } from './pdfFontResolver';

export interface RunPatch {
  opIndex: number;
  streamIndex: number;
  operandIndex: number;
  operator: 'Tj' | 'TJ' | "'" | '"';
  patchedOperatorText: string;
  originalText: string;
  newText: string;
  deltaWidth: number;
}

export class PdfTextEditEngine {
  /**
   * Computes a surgical run patch for replacing glyph range [startGlyphIndex, endGlyphIndex)
   * with replacementText, preserving every untouched glyph and applying kerning compensation.
   */
  public static computeGlyphPatch(
    run: PdfTextRun,
    startGlyphIndex: number,
    endGlyphIndex: number,
    replacementText: string,
    fontResolver: PdfFontResolver
  ): RunPatch {
    const totalGlyphs = run.glyphs.length;
    const safeStart = Math.max(0, Math.min(startGlyphIndex, totalGlyphs));
    const safeEnd = Math.max(safeStart, Math.min(endGlyphIndex, totalGlyphs));

    const prefixGlyphs = run.glyphs.slice(0, safeStart);
    const replacedGlyphs = run.glyphs.slice(safeStart, safeEnd);
    const suffixGlyphs = run.glyphs.slice(safeEnd);

    // Compute original width of the replaced glyphs
    let origReplacedWidth = 0;
    for (const g of replacedGlyphs) {
      origReplacedWidth += g.width;
    }

    // Resolve replacement character codes and widths
    const hScale = run.graphicsState.horizontalScale / 100;
    const replacementByteCodes: number[] = [];
    let newReplacementWidth = 0;

    for (let i = 0; i < replacementText.length; i++) {
      const char = replacementText[i];
      let code = fontResolver.lookupGlyphCode(run.fontResource, char);
      if (code === null) {
        code = char.charCodeAt(0);
      }
      replacementByteCodes.push(code);

      const w = fontResolver.getGlyphWidth(run.fontResource, code, run.fontSize) * hScale;
      newReplacementWidth += w;
    }

    const deltaWidth = newReplacementWidth - origReplacedWidth;

    // Check font type for multi-byte CID handling
    const isCID = fontResolver.getFontMetadata(run.fontResource)?.subtype === 'Type0';

    // Build raw hex or literal representation for replacement
    const replacementHex = this.codesToHex(replacementByteCodes, isCID);
    const replacementLiteral = this.codesToLiteral(replacementByteCodes);

    // Build prefix and suffix raw tokens
    const prefixHex = this.glyphsToHex(prefixGlyphs, isCID);
    const suffixHex = this.glyphsToHex(suffixGlyphs, isCID);

    let patchedOperatorText = '';

    if (run.operator === 'Tj' || run.operator === "'" || run.operator === '"') {
      const opName = run.operator;
      // Contiguous string replacement preserving normal typographic text flow
      if (run.isHexString) {
        const fullHex = prefixHex + replacementHex + suffixHex;
        patchedOperatorText = `<${fullHex}> ${opName}`;
      } else {
        const fullLiteral = this.glyphsToLiteral(prefixGlyphs) + replacementLiteral + this.glyphsToLiteral(suffixGlyphs);
        patchedOperatorText = `(${fullLiteral}) ${opName}`;
      }
    } else if (run.operator === 'TJ') {
      // In-place replacement inside TJ array element
      if (run.isHexString) {
        patchedOperatorText = `<${prefixHex}${replacementHex}${suffixHex}>`;
      } else {
        patchedOperatorText = `(${this.glyphsToLiteral(prefixGlyphs)}${replacementLiteral}${this.glyphsToLiteral(suffixGlyphs)})`;
      }
    }

    const originalReplacedText = replacedGlyphs.map((g) => g.char).join('');

    return {
      opIndex: run.opIndex,
      streamIndex: run.streamIndex,
      operandIndex: run.operandIndex,
      operator: run.operator,
      patchedOperatorText,
      originalText: originalReplacedText,
      newText: replacementText,
      deltaWidth,
    };
  }

  public static computeDiffRange(orig: string, repl: string): { prefixLen: number; origChangeLen: number; replChangeText: string } {
    let prefixLen = 0;
    while (prefixLen < orig.length && prefixLen < repl.length && orig[prefixLen] === repl[prefixLen]) {
      prefixLen++;
    }
    let suffixLen = 0;
    while (
      suffixLen < orig.length - prefixLen &&
      suffixLen < repl.length - prefixLen &&
      orig[orig.length - 1 - suffixLen] === repl[repl.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }
    const origChangeLen = orig.length - prefixLen - suffixLen;
    const replChangeText = repl.slice(prefixLen, repl.length - suffixLen);
    return { prefixLen, origChangeLen, replChangeText };
  }

  private static codesToHex(codes: number[], isCID: boolean = false): string {
    let hex = '';
    for (const c of codes) {
      if (isCID || c > 255) {
        hex += c.toString(16).padStart(4, '0').toUpperCase();
      } else {
        hex += c.toString(16).padStart(2, '0').toUpperCase();
      }
    }
    return hex;
  }

  private static glyphsToHex(glyphs: PdfGlyph[], isCID: boolean = false): string {
    let hex = '';
    for (const g of glyphs) {
      if (isCID || g.code > 255) {
        hex += g.code.toString(16).padStart(4, '0').toUpperCase();
      } else {
        hex += g.code.toString(16).padStart(2, '0').toUpperCase();
      }
    }
    return hex;
  }

  private static codesToLiteral(codes: number[]): string {
    let out = '';
    for (const c of codes) {
      if (c === 92) out += '\\\\';
      else if (c === 40) out += '\\(';
      else if (c === 41) out += '\\)';
      else if (c === 13) out += '\\r';
      else if (c === 10) out += '\\n';
      else if (c >= 32 && c <= 126) out += String.fromCharCode(c);
      else {
        out += '\\' + c.toString(8).padStart(3, '0');
      }
    }
    return out;
  }

  private static glyphsToLiteral(glyphs: PdfGlyph[]): string {
    return this.codesToLiteral(glyphs.map((g) => g.code));
  }
}
