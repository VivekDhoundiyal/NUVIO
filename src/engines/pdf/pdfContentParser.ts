import {
  PdfGraphicsState,
  type Matrix2D,
} from './pdfGraphicsState';
import type { PdfGlyph, PdfTextRun, PdfTextObject } from './pdfTextObjectModel';
import { PdfFontResolver } from './pdfFontResolver';

export type TokenType =
  | 'string'
  | 'hexstring'
  | 'number'
  | 'name'
  | 'array'
  | 'dict'
  | 'operator';

export interface Token {
  type: TokenType;
  value: any;
  raw: string;
}

export interface StreamOperation {
  opIndex: number;
  operator: string;
  operands: Token[];
  rawText: string;
}

function isWhitespace(code: number): boolean {
  return code === 0 || code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

export class PdfContentParser {
  /**
   * Tokenizes PostScript content stream text into structured tokens.
   */
  public static tokenize(streamText: string): Token[] {
    const tokens: Token[] = [];
    const len = streamText.length;
    let i = 0;

    while (i < len) {
      const code = streamText.charCodeAt(i);

      // Whitespace
      if (isWhitespace(code)) {
        i++;
        continue;
      }

      // Comments (%)
      if (code === 37) {
        while (i < len && streamText.charCodeAt(i) !== 10 && streamText.charCodeAt(i) !== 13) {
          i++;
        }
        continue;
      }

      // Literal Strings (...)
      if (code === 40) {
        let depth = 1;
        let str = '';
        const start = i;
        i++; // skip '('

        while (i < len && depth > 0) {
          const c = streamText.charAt(i);
          if (c === '\\') {
            i++;
            if (i < len) {
              const esc = streamText.charAt(i);
              if (esc === 'n') str += '\n';
              else if (esc === 'r') str += '\r';
              else if (esc === 't') str += '\t';
              else if (esc === 'b') str += '\b';
              else if (esc === 'f') str += '\f';
              else if (esc === '(') str += '(';
              else if (esc === ')') str += ')';
              else if (esc === '\\') str += '\\';
              else if (/[0-7]/.test(esc)) {
                let oct = esc;
                if (i + 1 < len && /[0-7]/.test(streamText.charAt(i + 1))) {
                  i++;
                  oct += streamText.charAt(i);
                  if (i + 1 < len && /[0-7]/.test(streamText.charAt(i + 1))) {
                    i++;
                    oct += streamText.charAt(i);
                  }
                }
                str += PdfFontResolver.decodeWinAnsiCode(parseInt(oct, 8));
              } else {
                str += esc;
              }
            }
          } else if (c === '(') {
            depth++;
            str += c;
          } else if (c === ')') {
            depth--;
            if (depth > 0) str += c;
          } else {
            str += c;
          }
          i++;
        }

        tokens.push({
          type: 'string',
          value: str,
          raw: streamText.slice(start, i),
        });
        continue;
      }

      // Hex Strings <...> or Dict Open <<
      if (code === 60) {
        if (i + 1 < len && streamText.charCodeAt(i + 1) === 60) {
          tokens.push({ type: 'dict', value: '<<', raw: '<<' });
          i += 2;
          continue;
        }

        const start = i;
        i++; // skip '<'
        let hex = '';
        while (i < len && streamText.charCodeAt(i) !== 62) {
          const c = streamText.charAt(i);
          if (!isWhitespace(streamText.charCodeAt(i))) {
            hex += c;
          }
          i++;
        }
        if (i < len) i++; // skip '>'

        tokens.push({
          type: 'hexstring',
          value: hex,
          raw: streamText.slice(start, i),
        });
        continue;
      }

      // Dict Close >>
      if (code === 62 && i + 1 < len && streamText.charCodeAt(i + 1) === 62) {
        tokens.push({ type: 'dict', value: '>>', raw: '>>' });
        i += 2;
        continue;
      }

      // Arrays [...]
      if (code === 91) {
        const start = i;
        i++; // skip '['
        const arrayTokens: Token[] = [];

        while (i < len) {
          while (i < len && isWhitespace(streamText.charCodeAt(i))) i++;
          if (i >= len || streamText.charCodeAt(i) === 93) break;

          const innerCode = streamText.charCodeAt(i);
          if (innerCode === 40) {
            // Inner literal string
            let d = 1;
            let str = '';
            const sStart = i++;
            while (i < len && d > 0) {
              const c = streamText.charAt(i);
              if (c === '\\') {
                i += 2;
                str += streamText.charAt(i - 1);
                continue;
              }
              if (c === '(') d++;
              else if (c === ')') d--;
              if (d > 0) str += c;
              i++;
            }
            arrayTokens.push({
              type: 'string',
              value: str,
              raw: streamText.slice(sStart, i),
            });
          } else if (innerCode === 60 && streamText.charCodeAt(i + 1) !== 60) {
            // Inner hex string
            const hStart = i++;
            let hex = '';
            while (i < len && streamText.charCodeAt(i) !== 62) {
              if (!isWhitespace(streamText.charCodeAt(i))) hex += streamText.charAt(i);
              i++;
            }
            if (i < len) i++;
            arrayTokens.push({
              type: 'hexstring',
              value: hex,
              raw: streamText.slice(hStart, i),
            });
          } else {
            // Inner number or name
            const nStart = i;
            while (
              i < len &&
              !isWhitespace(streamText.charCodeAt(i)) &&
              streamText.charCodeAt(i) !== 93 &&
              streamText.charCodeAt(i) !== 40 &&
              streamText.charCodeAt(i) !== 60
            ) {
              i++;
            }
            const word = streamText.slice(nStart, i);
            const num = Number(word);
            if (!isNaN(num)) {
              arrayTokens.push({ type: 'number', value: num, raw: word });
            } else {
              arrayTokens.push({ type: 'name', value: word, raw: word });
            }
          }
        }

        if (i < len && streamText.charCodeAt(i) === 93) i++; // skip ']'

        tokens.push({
          type: 'array',
          value: arrayTokens,
          raw: streamText.slice(start, i),
        });
        continue;
      }

      // Names /Name
      if (code === 47) {
        const start = i;
        i++; // skip '/'
        while (
          i < len &&
          !isWhitespace(streamText.charCodeAt(i)) &&
          streamText.charCodeAt(i) !== 47 &&
          streamText.charCodeAt(i) !== 40 &&
          streamText.charCodeAt(i) !== 60 &&
          streamText.charCodeAt(i) !== 91
        ) {
          i++;
        }
        tokens.push({
          type: 'name',
          value: streamText.slice(start, i),
          raw: streamText.slice(start, i),
        });
        continue;
      }

      // Numbers or Operators
      const start = i;
      while (
        i < len &&
        !isWhitespace(streamText.charCodeAt(i)) &&
        streamText.charCodeAt(i) !== 47 &&
        streamText.charCodeAt(i) !== 40 &&
        streamText.charCodeAt(i) !== 60 &&
        streamText.charCodeAt(i) !== 62 &&
        streamText.charCodeAt(i) !== 91 &&
        streamText.charCodeAt(i) !== 93
      ) {
        i++;
      }
      const tokenStr = streamText.slice(start, i);
      const num = Number(tokenStr);
      if (!isNaN(num) && tokenStr.trim() !== '') {
        tokens.push({ type: 'number', value: num, raw: tokenStr });
      } else {
        tokens.push({ type: 'operator', value: tokenStr, raw: tokenStr });
      }
    }

    return tokens;
  }

  /**
   * Groups tokens into structured PostScript StreamOperations.
   */
  public static parseOperations(tokens: Token[]): StreamOperation[] {
    const operations: StreamOperation[] = [];
    let currentOperands: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'operator') {
        const rawText = currentOperands.map((t) => t.raw).join(' ') + (currentOperands.length ? ' ' : '') + token.raw;
        operations.push({
          opIndex: operations.length,
          operator: token.value as string,
          operands: currentOperands,
          rawText,
        });
        currentOperands = [];
      } else {
        currentOperands.push(token);
      }
    }

    return operations;
  }

  /**
   * Parses stream operations into a rich hierarchy of PdfTextObjects, PdfTextRuns, and PdfGlyphs.
   */
  public static extractTextObjects(
    operations: StreamOperation[],
    fontResolver: PdfFontResolver,
    streamIndex: number = 0,
    pageIndex: number = 0
  ): PdfTextObject[] {
    const textObjects: PdfTextObject[] = [];
    const gstate = new PdfGraphicsState();

    let currentTextObject: PdfTextObject | null = null;
    let glyphCounter = 0;

    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx];
      const name = op.operator;
      const args = op.operands;

      // Graphics state save / restore
      if (name === 'q') {
        gstate.save();
      } else if (name === 'Q') {
        gstate.restore();
      } else if (name === 'cm' && args.length >= 6) {
        const m = args.map((a) => Number(a.value) || 0) as Matrix2D;
        gstate.concatenateCTM(m);
      }

      // Text Object boundaries
      else if (name === 'BT') {
        gstate.beginText();
        currentTextObject = {
          id: `txtobj-${pageIndex}-${streamIndex}-${opIdx}`,
          pageIndex,
          streamIndex,
          startOpIndex: opIdx,
          endOpIndex: opIdx,
          runs: [],
          bbox: { x: 0, y: 0, width: 0, height: 0 },
        };
      } else if (name === 'ET') {
        gstate.endText();
        if (currentTextObject) {
          currentTextObject.endOpIndex = opIdx;
          this.computeTextObjectBBox(currentTextObject);
          textObjects.push(currentTextObject);
          currentTextObject = null;
        }
      }

      // Font & Font Size: /F1 24 Tf
      else if (name === 'Tf' && args.length >= 2) {
        const fontName = String(args[0].value || '');
        const fontSize = Number(args[1].value) || 12;
        gstate.setFont(fontName, fontSize);
      }

      // Text Matrix & Position
      else if (name === 'Tm' && args.length >= 6) {
        const m = args.map((a) => Number(a.value) || 0) as Matrix2D;
        gstate.setTextMatrix(m);
      } else if (name === 'Td' && args.length >= 2) {
        gstate.moveTextPosition(Number(args[0].value) || 0, Number(args[1].value) || 0);
      } else if (name === 'TD' && args.length >= 2) {
        gstate.moveTextPositionWithLeading(Number(args[0].value) || 0, Number(args[1].value) || 0);
      } else if (name === 'T*') {
        gstate.nextLine();
      }

      // Text State
      else if (name === 'Tc' && args.length >= 1) {
        gstate.charSpacing = Number(args[0].value) || 0;
      } else if (name === 'Tw' && args.length >= 1) {
        gstate.wordSpacing = Number(args[0].value) || 0;
      } else if (name === 'Tz' && args.length >= 1) {
        gstate.horizontalScale = Number(args[0].value) || 100;
      } else if (name === 'TL' && args.length >= 1) {
        gstate.leading = Number(args[0].value) || 12;
      } else if (name === 'Ts' && args.length >= 1) {
        gstate.rise = Number(args[0].value) || 0;
      } else if (name === 'Tr' && args.length >= 1) {
        gstate.renderMode = Number(args[0].value) || 0;
      }

      // Colors
      else if (name === 'rg' && args.length >= 3) {
        gstate.fillColor = {
          r: Number(args[0].value) || 0,
          g: Number(args[1].value) || 0,
          b: Number(args[2].value) || 0,
        };
      } else if (name === 'g' && args.length >= 1) {
        const val = Number(args[0].value) || 0;
        gstate.fillColor = { r: val, g: val, b: val };
      } else if (name === 'k' && args.length >= 4) {
        const c = Number(args[0].value) || 0;
        const m = Number(args[1].value) || 0;
        const y = Number(args[2].value) || 0;
        const k = Number(args[3].value) || 0;
        gstate.fillColor = {
          r: (1 - c) * (1 - k),
          g: (1 - m) * (1 - k),
          b: (1 - y) * (1 - k),
        };
      }

      // Text Showing Operators: Tj, TJ, ', "
      else if (name === 'Tj' || name === "'" || name === '"') {
        if (name === "'") gstate.nextLine();
        if (name === '"' && args.length >= 3) {
          gstate.wordSpacing = Number(args[0].value) || 0;
          gstate.charSpacing = Number(args[1].value) || 0;
          gstate.nextLine();
        }

        const stringArg = name === '"' ? args[2] : args[0];
        if (stringArg && (stringArg.type === 'string' || stringArg.type === 'hexstring')) {
          const run = this.processTextStringToken(
            stringArg,
            0,
            opIdx,
            streamIndex,
            name as any,
            gstate,
            fontResolver,
            glyphCounter
          );
          glyphCounter += run.glyphs.length;

          if (currentTextObject) {
            currentTextObject.runs.push(run);
          }
        }
      } else if (name === 'TJ' && args.length >= 1 && args[0].type === 'array') {
        const arrayTokens = args[0].value as Token[];
        for (let arrIdx = 0; arrIdx < arrayTokens.length; arrIdx++) {
          const item = arrayTokens[arrIdx];
          if (item.type === 'string' || item.type === 'hexstring') {
            const run = this.processTextStringToken(
              item,
              arrIdx,
              opIdx,
              streamIndex,
              'TJ',
              gstate,
              fontResolver,
              glyphCounter
            );
            glyphCounter += run.glyphs.length;

            if (currentTextObject) {
              currentTextObject.runs.push(run);
            }
          } else if (item.type === 'number') {
            // Kerning displacement adjustment: subtract item.value / 1000 * fontSize in text space
            const kerningNum = Number(item.value) || 0;
            const tx = (-kerningNum / 1000) * gstate.fontSize * (gstate.horizontalScale / 100);
            gstate.advanceText(tx, 0);
          }
        }
      }
    }

    return textObjects;
  }

  /**
   * Processes a single string token into a PdfTextRun and advances graphics state.
   */
  private static processTextStringToken(
    token: Token,
    operandIndex: number,
    opIndex: number,
    streamIndex: number,
    operator: 'Tj' | 'TJ' | "'" | '"',
    gstate: PdfGraphicsState,
    fontResolver: PdfFontResolver,
    glyphCounterStart: number
  ): PdfTextRun {
    const isHexString = token.type === 'hexstring';
    const glyphs: PdfGlyph[] = [];
    const hScale = gstate.horizontalScale / 100;
    const startPos = gstate.getCurrentPagePosition();
    let decodedFullText = '';

    if (isHexString) {
      const hex = token.value as string;
      const clean = hex.replace(/[^0-9A-Fa-f]/g, '');

      // Check if 2-byte CID (Type0) or 1-byte font
      const meta = fontResolver.getFontMetadata(gstate.fontResource);
      const isCID = meta?.subtype === 'Type0';
      const step = isCID ? 4 : 2;

      for (let i = 0; i < clean.length; i += step) {
        const codeHex = clean.slice(i, i + step);
        const code = parseInt(codeHex, 16);
        const char = fontResolver.decodeGlyph(gstate.fontResource, code);
        decodedFullText += char;

        const pos = gstate.getCurrentPagePosition();
        const glyphWidth = fontResolver.getGlyphWidth(gstate.fontResource, code, gstate.fontSize) * hScale;

        glyphs.push({
          id: `glyph-${opIndex}-${operandIndex}-${i / step}-${glyphCounterStart + glyphs.length}`,
          char,
          code,
          rawBytes: new Uint8Array([code]),
          x: pos.x,
          y: pos.y,
          width: glyphWidth,
          height: gstate.fontSize,
          fontResource: gstate.fontResource,
          fontSize: gstate.fontSize,
          fillColor: { ...gstate.fillColor },
          strokeColor: { ...gstate.strokeColor },
          fillAlpha: gstate.fillAlpha,
          charSpacing: gstate.charSpacing,
          wordSpacing: gstate.wordSpacing,
          horizontalScale: gstate.horizontalScale,
          textMatrix: [...gstate.tm] as Matrix2D,
          ctm: [...gstate.ctm] as Matrix2D,
          opIndex,
          streamIndex,
          operandIndex,
          charIndexInOperand: i / step,
          isModified: false,
        });

        const isSpace = char === ' ';
        const advance = (glyphWidth / hScale + gstate.charSpacing + (isSpace ? gstate.wordSpacing : 0)) * hScale;
        gstate.advanceText(advance, 0);
      }
    } else {
      const rawStr = token.value as string;
      for (let i = 0; i < rawStr.length; i++) {
        const code = rawStr.charCodeAt(i);
        const char = fontResolver.decodeGlyph(gstate.fontResource, code);
        decodedFullText += char;

        const pos = gstate.getCurrentPagePosition();
        const glyphWidth = fontResolver.getGlyphWidth(gstate.fontResource, code, gstate.fontSize) * hScale;

        glyphs.push({
          id: `glyph-${opIndex}-${operandIndex}-${i}-${glyphCounterStart + glyphs.length}`,
          char,
          code,
          rawBytes: new Uint8Array([code]),
          x: pos.x,
          y: pos.y,
          width: glyphWidth,
          height: gstate.fontSize,
          fontResource: gstate.fontResource,
          fontSize: gstate.fontSize,
          fillColor: { ...gstate.fillColor },
          strokeColor: { ...gstate.strokeColor },
          fillAlpha: gstate.fillAlpha,
          charSpacing: gstate.charSpacing,
          wordSpacing: gstate.wordSpacing,
          horizontalScale: gstate.horizontalScale,
          textMatrix: [...gstate.tm] as Matrix2D,
          ctm: [...gstate.ctm] as Matrix2D,
          opIndex,
          streamIndex,
          operandIndex,
          charIndexInOperand: i,
          isModified: false,
        });

        const isSpace = char === ' ';
        const advance = (glyphWidth / hScale + gstate.charSpacing + (isSpace ? gstate.wordSpacing : 0)) * hScale;
        gstate.advanceText(advance, 0);
      }
    }

    const endPos = gstate.getCurrentPagePosition();
    const runWidth = Math.max(1, endPos.x - startPos.x);

    return {
      id: `run-${opIndex}-${operandIndex}`,
      opIndex,
      streamIndex,
      operator,
      operandIndex,
      text: decodedFullText,
      decodedText: decodedFullText,
      glyphs,
      x: startPos.x,
      y: startPos.y,
      width: runWidth,
      height: gstate.fontSize,
      fontResource: gstate.fontResource,
      fontSize: gstate.fontSize,
      fillColor: { ...gstate.fillColor },
      strokeColor: { ...gstate.strokeColor },
      graphicsState: gstate.snapshot(),
      rawOperandText: token.raw,
      isHexString,
      isModified: false,
    };
  }

  /**
   * Computes the bounding box of a text object.
   */
  private static computeTextObjectBBox(txtObj: PdfTextObject): void {
    if (txtObj.runs.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const run of txtObj.runs) {
      for (const g of run.glyphs) {
        minX = Math.min(minX, g.x);
        minY = Math.min(minY, g.y);
        maxX = Math.max(maxX, g.x + g.width);
        maxY = Math.max(maxY, g.y + g.height);
      }
    }

    if (minX !== Infinity) {
      txtObj.bbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
  }
}
