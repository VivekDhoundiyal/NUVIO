import {
  PDFDocument,
  PDFPage,
  PDFName,
  PDFDict,
  PDFArray,
  PDFStream,
  decodePDFRawStream,
  PDFRawStream,
} from 'pdf-lib';

export interface FontMetadata {
  resourceName: string;
  baseFont: string;
  subtype: string;
  isSubset: boolean;
  subsetPrefix?: string;
  firstChar: number;
  lastChar: number;
  widths: number[];
  defaultWidth: number;
  toUnicodeMap: Map<number, string>;
  unicodeToCodeMap: Map<string, number>;
  encodingName?: string;
  embeddedFontData?: Uint8Array;
}

// Standard WinAnsiEncoding table for ASCII / Latin-1 range
const WIN_ANSI_MAP: Record<number, string> = {
  32: ' ', 33: '!', 34: '"', 35: '#', 36: '$', 37: '%', 38: '&', 39: "'",
  40: '(', 41: ')', 42: '*', 43: '+', 44: ',', 45: '-', 46: '.', 47: '/',
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7',
  56: '8', 57: '9', 58: ':', 59: ';', 60: '<', 61: '=', 62: '>', 63: '?',
  64: '@', 65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G',
  72: 'H', 73: 'I', 74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O',
  80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W',
  88: 'X', 89: 'Y', 90: 'Z', 91: '[', 92: '\\', 93: ']', 94: '^', 95: '_',
  96: '`', 97: 'a', 98: 'b', 99: 'c', 100: 'd', 101: 'e', 102: 'f', 103: 'g',
  104: 'h', 105: 'i', 106: 'j', 107: 'k', 108: 'l', 109: 'm', 110: 'n', 111: 'o',
  112: 'p', 113: 'q', 114: 'r', 115: 's', 116: 't', 117: 'u', 118: 'v', 119: 'w',
  120: 'x', 121: 'y', 122: 'z', 123: '{', 124: '|', 125: '}', 126: '~',
  // Windows-1252 / WinAnsi Latin extensions
  130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰',
  138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”',
  149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ',
  158: 'ž', 159: 'Ÿ', 160: ' ', 161: '¡', 162: '¢', 163: '£', 164: '¤', 165: '¥',
  166: '¦', 167: '§', 168: '¨', 169: '©', 170: 'ª', 171: '«', 172: '¬', 173: '­',
  174: '®', 175: '¯', 176: '°', 177: '±', 178: '²', 179: '³', 180: '´', 181: 'µ',
  182: '¶', 183: '·', 184: '¸', 185: '¹', 186: 'º', 187: '»', 188: '¼', 189: '½',
  190: '¾', 191: '¿', 192: 'À', 193: 'Á', 194: 'Â', 195: 'Ã', 196: 'Ä', 197: 'Å',
  198: 'Æ', 199: 'Ç', 200: 'È', 201: 'É', 202: 'Ê', 203: 'Ë', 204: 'Ì', 205: 'Í',
  206: 'Î', 207: 'Ï', 208: 'Ð', 209: 'Ñ', 210: 'Ò', 211: 'Ó', 212: 'Ô', 213: 'Õ',
  214: 'Ö', 215: '×', 216: 'Ø', 217: 'Ù', 218: 'Ú', 219: 'Û', 220: 'Ü', 221: 'Ý',
  222: 'Þ', 223: 'ß', 224: 'à', 225: 'á', 226: 'â', 227: 'ã', 228: 'ä', 229: 'å',
  230: 'æ', 231: 'ç', 232: 'è', 233: 'é', 234: 'ê', 235: 'ë', 236: 'ì', 237: 'í',
  238: 'î', 239: 'ï', 240: 'ð', 241: 'ñ', 242: 'ò', 243: 'ó', 244: 'ô', 245: 'õ',
  246: 'ö', 247: '÷', 248: 'ø', 249: 'ù', 250: 'ú', 251: 'û', 252: 'ü', 253: 'ý',
  254: 'þ', 255: 'ÿ',
};

export class PdfFontResolver {
  public static decodeWinAnsiCode(code: number): string {
    return WIN_ANSI_MAP[code] || String.fromCharCode(code);
  }

  private fontCache = new Map<string, FontMetadata>();

  /**
   * Parses and caches all font resources defined in a page's /Resources dictionary.
   */
  public async loadPageFonts(pdfDoc: PDFDocument, page: PDFPage): Promise<void> {
    const resourcesRef = page.node.Resources();
    if (!resourcesRef) return;

    const resources = pdfDoc.context.lookup(resourcesRef);
    if (!(resources instanceof PDFDict)) return;

    const fontDictRef = resources.get(PDFName.of('Font'));
    if (!fontDictRef) return;

    const fontDict = pdfDoc.context.lookup(fontDictRef);
    if (!(fontDict instanceof PDFDict)) return;

    const fontEntries = fontDict.entries();
    for (const [keyName, fontRef] of fontEntries) {
      const resourceKey = `/${keyName.asString()}`;
      if (this.fontCache.has(resourceKey)) continue;

      const fontObj = pdfDoc.context.lookup(fontRef);
      if (!(fontObj instanceof PDFDict)) continue;

      const metadata = this.parseFontDict(pdfDoc, resourceKey, fontObj);
      this.fontCache.set(resourceKey, metadata);
    }
  }

  /**
   * Parses font dictionary metadata, CMap, widths, and encoding.
   */
  private parseFontDict(pdfDoc: PDFDocument, resourceName: string, fontDict: PDFDict): FontMetadata {
    const subtype = (fontDict.lookup(PDFName.of('Subtype')) as any)?.asString?.() || 'TrueType';
    const baseFont = (fontDict.lookup(PDFName.of('BaseFont')) as any)?.asString?.() || '';

    // Check subset prefix (e.g. ABCDEF+FontName)
    let isSubset = false;
    let subsetPrefix: string | undefined;
    const plusIdx = baseFont.indexOf('+');
    if (plusIdx === 6) {
      isSubset = true;
      subsetPrefix = baseFont.slice(0, 6);
    }

    const firstChar = (fontDict.lookup(PDFName.of('FirstChar')) as any)?.asNumber?.() || 0;
    const lastChar = (fontDict.lookup(PDFName.of('LastChar')) as any)?.asNumber?.() || 255;

    // Widths array
    const widths: number[] = [];
    const widthsRef = fontDict.get(PDFName.of('Widths'));
    if (widthsRef) {
      const widthsObj = pdfDoc.context.lookup(widthsRef);
      if (widthsObj instanceof PDFArray) {
        for (let i = 0; i < widthsObj.size(); i++) {
          widths.push((widthsObj.get(i) as any)?.asNumber?.() || 500);
        }
      }
    }

    // Default width from FontDescriptor
    let defaultWidth = 500;
    const descriptorRef = fontDict.get(PDFName.of('FontDescriptor'));
    if (descriptorRef) {
      const desc = pdfDoc.context.lookup(descriptorRef);
      if (desc instanceof PDFDict) {
        const mw = desc.lookup(PDFName.of('MissingWidth')) as any;
        if (mw && typeof mw.asNumber === 'function') {
          defaultWidth = mw.asNumber();
        }
      }
    }

    // Parse ToUnicode CMap
    const toUnicodeMap = new Map<number, string>();
    const unicodeToCodeMap = new Map<string, number>();

    const toUnicodeRef = fontDict.get(PDFName.of('ToUnicode'));
    if (toUnicodeRef) {
      const toUnicodeObj = pdfDoc.context.lookup(toUnicodeRef);
      if (toUnicodeObj instanceof PDFStream || toUnicodeObj instanceof PDFRawStream) {
        this.parseToUnicodeCMap(toUnicodeObj, toUnicodeMap, unicodeToCodeMap);
      }
    }

    // If ToUnicode was missing or incomplete, populate from standard WinAnsiEncoding
    if (toUnicodeMap.size === 0) {
      for (const [codeStr, char] of Object.entries(WIN_ANSI_MAP)) {
        const code = Number(codeStr);
        toUnicodeMap.set(code, char);
        if (!unicodeToCodeMap.has(char)) {
          unicodeToCodeMap.set(char, code);
        }
      }
    }

    // Extract embedded font data if available
    let embeddedFontData: Uint8Array | undefined;
    if (descriptorRef) {
      const desc = pdfDoc.context.lookup(descriptorRef);
      if (desc instanceof PDFDict) {
        const fontFile2Ref = desc.get(PDFName.of('FontFile2')) || desc.get(PDFName.of('FontFile3')) || desc.get(PDFName.of('FontFile'));
        if (fontFile2Ref) {
          const fontFileStream = pdfDoc.context.lookup(fontFile2Ref);
          if (fontFileStream instanceof PDFRawStream) {
            try {
              const decoded = decodePDFRawStream(fontFileStream);
              embeddedFontData = decoded ? decoded.decode() : fontFileStream.asUint8Array();
            } catch {
              embeddedFontData = fontFileStream.asUint8Array();
            }
          }
        }
      }
    }

    return {
      resourceName,
      baseFont,
      subtype,
      isSubset,
      subsetPrefix,
      firstChar,
      lastChar,
      widths,
      defaultWidth,
      toUnicodeMap,
      unicodeToCodeMap,
      embeddedFontData,
    };
  }

  /**
   * Parses a /ToUnicode CMap stream for glyph-to-unicode mappings.
   */
  private parseToUnicodeCMap(
    stream: PDFStream | PDFRawStream,
    toUnicodeMap: Map<number, string>,
    unicodeToCodeMap: Map<string, number>
  ): void {
    let text = '';
    try {
      if (stream instanceof PDFRawStream) {
        const decoded = decodePDFRawStream(stream);
        const bytes = decoded ? decoded.decode() : stream.asUint8Array();
        text = new TextDecoder('latin1').decode(bytes);
      } else {
        text = new TextDecoder('latin1').decode((stream as any).asUint8Array());
      }
    } catch {
      return;
    }

    // 1. beginbfchar ... endbfchar blocks: <srcCode> <dstUnicode>
    const bfcharRegex = /beginbfchar\s+([\s\S]*?)\s+endbfchar/g;
    let match: RegExpExecArray | null;
    while ((match = bfcharRegex.exec(text)) !== null) {
      const block = match[1];
      const entryRegex = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g;
      let eMatch: RegExpExecArray | null;
      while ((eMatch = entryRegex.exec(block)) !== null) {
        const srcCode = parseInt(eMatch[1], 16);
        const dstHex = eMatch[2];
        let decodedStr = '';
        for (let i = 0; i < dstHex.length; i += 4) {
          const uCode = parseInt(dstHex.slice(i, i + 4), 16);
          if (!isNaN(uCode)) {
            decodedStr += String.fromCharCode(uCode);
          }
        }
        if (decodedStr) {
          toUnicodeMap.set(srcCode, decodedStr);
          if (!unicodeToCodeMap.has(decodedStr)) {
            unicodeToCodeMap.set(decodedStr, srcCode);
          }
        }
      }
    }

    // 2. beginbfrange ... endbfrange blocks: <srcCode1> <srcCode2> <dstCode1>
    const bfrangeRegex = /beginbfrange\s+([\s\S]*?)\s+endbfrange/g;
    while ((match = bfrangeRegex.exec(text)) !== null) {
      const block = match[1];
      const rangeRegex = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rangeRegex.exec(block)) !== null) {
        const startCode = parseInt(rMatch[1], 16);
        const endCode = parseInt(rMatch[2], 16);
        let startUnicode = parseInt(rMatch[3], 16);

        for (let code = startCode; code <= endCode; code++) {
          const char = String.fromCharCode(startUnicode);
          toUnicodeMap.set(code, char);
          if (!unicodeToCodeMap.has(char)) {
            unicodeToCodeMap.set(char, code);
          }
          startUnicode++;
        }
      }
    }
  }

  /**
   * Decodes a byte sequence into a Unicode character using the font's CMap/Encoding.
   */
  public decodeGlyph(fontResource: string, code: number): string {
    const meta = this.fontCache.get(fontResource);
    if (meta && meta.toUnicodeMap.has(code)) {
      return meta.toUnicodeMap.get(code)!;
    }
    if (WIN_ANSI_MAP[code]) {
      return WIN_ANSI_MAP[code];
    }
    return String.fromCharCode(code);
  }

  /**
   * Checks if a Unicode character is supported in this font resource.
   */
  public hasGlyph(fontResource: string, char: string): boolean {
    const meta = this.fontCache.get(fontResource);
    if (meta && meta.unicodeToCodeMap.has(char)) {
      return true;
    }
    const asciiCode = char.charCodeAt(0);
    return asciiCode >= 32 && asciiCode <= 126;
  }

  /**
   * Resolves the exact raw character code / byte sequence for a Unicode character in this font.
   */
  public lookupGlyphCode(fontResource: string, char: string): number | null {
    const meta = this.fontCache.get(fontResource);
    if (meta && meta.unicodeToCodeMap.has(char)) {
      return meta.unicodeToCodeMap.get(char)!;
    }
    const asciiCode = char.charCodeAt(0);
    if (asciiCode >= 32 && asciiCode <= 126) {
      return asciiCode;
    }
    return null;
  }

  /**
   * Computes glyph advance width in points at a given font size.
   */
  public getGlyphWidth(fontResource: string, code: number, fontSize: number): number {
    const meta = this.fontCache.get(fontResource);
    if (!meta) {
      return fontSize * 0.55;
    }

    if (code >= meta.firstChar && code <= meta.lastChar && meta.widths.length > 0) {
      const idx = code - meta.firstChar;
      if (idx < meta.widths.length) {
        return (meta.widths[idx] / 1000) * fontSize;
      }
    }

    return (meta.defaultWidth / 1000) * fontSize;
  }

  /**
   * Retrieves font metadata.
   */
  public getFontMetadata(fontResource: string): FontMetadata | undefined {
    return this.fontCache.get(fontResource);
  }
}
