/**
 * Precision PDF Content Stream Lexer, Parser, and AST Serializer
 *
 * Implements ISO 32000-1 content stream tokenization and operator reconstruction.
 * Enables surgical, in-place operator mutation (replacing Tj/TJ text strings,
 * font sizes, colors, and text matrices) directly within the PDF /Contents stream
 * without rasterization, HTML conversion, or opaque background masks.
 */

export type TokenType =
  | 'operator'
  | 'number'
  | 'string'
  | 'hexstring'
  | 'name'
  | 'array'
  | 'dict'
  | 'boolean';

export interface Token {
  type: TokenType;
  value: any;
  raw: string;
}

export interface StreamOperation {
  opIndex: number;
  operator: string;
  operands: Token[];
  startOffset?: number;
  endOffset?: number;
}

export interface GraphicsState {
  fontResource: string;
  fontSize: number;
  textMatrix: number[]; // [a, b, c, d, e, f]
  lineMatrix: number[];
  ctm: number[]; // Current Transformation Matrix
  fillColor: { r: number; g: number; b: number };
  strokeColor: { r: number; g: number; b: number };
  charSpacing: number; // Tc
  wordSpacing: number; // Tw
  horizontalScale: number; // Tz (percentage, default 100)
  textLeading: number; // TL
  renderMode: number; // Tr
}

export interface ParsedTextRun {
  opIndex: number;
  streamIndex: number;
  operator: 'Tj' | 'TJ' | "'" | '"';
  fontResource: string;
  fontSize: number;
  color: { r: number; g: number; b: number };
  textMatrix: number[];
  decodedText: string;
  rawOperands: Token[];
  x: number;
  y: number;
}

// Standard PDF whitespace characters
function isWhitespace(ch: number): boolean {
  return ch === 0 || ch === 9 || ch === 10 || ch === 12 || ch === 13 || ch === 32;
}

// Standard PDF delimiter characters
function isDelimiter(ch: number): boolean {
  return (
    ch === 40 || // (
    ch === 41 || // )
    ch === 60 || // <
    ch === 62 || // >
    ch === 91 || // [
    ch === 93 || // ]
    ch === 123 || // {
    ch === 125 || // }
    ch === 47 || // /
    ch === 37 // %
  );
}

export class PdfContentStreamParser {
  /**
   * Tokenizes decompressed PDF content stream bytes into tokens.
   */
  static tokenize(streamText: string): Token[] {
    const tokens: Token[] = [];
    const len = streamText.length;
    let i = 0;

    while (i < len) {
      const code = streamText.charCodeAt(i);

      // 1. Whitespace
      if (isWhitespace(code)) {
        i++;
        continue;
      }

      // 2. Comments (%)
      if (code === 37) {
        while (i < len && streamText.charCodeAt(i) !== 10 && streamText.charCodeAt(i) !== 13) {
          i++;
        }
        continue;
      }

      // 3. Literal Strings (...)
      if (code === 40) {
        let depth = 1;
        let strContent = '';
        const start = i;
        i++; // skip '('

        while (i < len && depth > 0) {
          const c = streamText.charAt(i);
          if (c === '\\') {
            i++;
            if (i < len) {
              const esc = streamText.charAt(i);
              if (esc === 'n') strContent += '\n';
              else if (esc === 'r') strContent += '\r';
              else if (esc === 't') strContent += '\t';
              else if (esc === 'b') strContent += '\b';
              else if (esc === 'f') strContent += '\f';
              else if (esc === '(') strContent += '(';
              else if (esc === ')') strContent += ')';
              else if (esc === '\\') strContent += '\\';
              else if (/[0-7]/.test(esc)) {
                // Octal escape
                let oct = esc;
                if (i + 1 < len && /[0-7]/.test(streamText.charAt(i + 1))) {
                  i++;
                  oct += streamText.charAt(i);
                  if (i + 1 < len && /[0-7]/.test(streamText.charAt(i + 1))) {
                    i++;
                    oct += streamText.charAt(i);
                  }
                }
                strContent += String.fromCharCode(parseInt(oct, 8));
              } else {
                strContent += esc;
              }
            }
          } else if (c === '(') {
            depth++;
            strContent += c;
          } else if (c === ')') {
            depth--;
            if (depth > 0) strContent += c;
          } else {
            strContent += c;
          }
          i++;
        }

        tokens.push({
          type: 'string',
          value: strContent,
          raw: streamText.slice(start, i),
        });
        continue;
      }

      // 4. Hex Strings <...> or Dict open <<
      if (code === 60) {
        if (i + 1 < len && streamText.charCodeAt(i + 1) === 60) {
          // << Dict open
          tokens.push({ type: 'dict', value: '<<', raw: '<<' });
          i += 2;
          continue;
        }

        // Hex string
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

      // Dict close >>
      if (code === 62 && i + 1 < len && streamText.charCodeAt(i + 1) === 62) {
        tokens.push({ type: 'dict', value: '>>', raw: '>>' });
        i += 2;
        continue;
      }

      // 5. Arrays [...]
      if (code === 91) {
        // Parse array contents
        const start = i;
        i++; // skip '['
        const arrayTokens: Token[] = [];

        // Collect tokens until matching ']'
        while (i < len) {
          // skip whitespace
          while (i < len && isWhitespace(streamText.charCodeAt(i))) i++;
          if (i >= len || streamText.charCodeAt(i) === 93) break;

          // Inner token
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
            // Number or other token inside array
            const tStart = i;
            while (
              i < len &&
              !isWhitespace(streamText.charCodeAt(i)) &&
              streamText.charCodeAt(i) !== 93 &&
              streamText.charCodeAt(i) !== 40 &&
              streamText.charCodeAt(i) !== 60
            ) {
              i++;
            }
            const rawVal = streamText.slice(tStart, i);
            const num = parseFloat(rawVal);
            arrayTokens.push({
              type: isNaN(num) ? 'operator' : 'number',
              value: isNaN(num) ? rawVal : num,
              raw: rawVal,
            });
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

      // 6. Names /Name
      if (code === 47) {
        const start = i;
        i++; // skip '/'
        while (i < len && !isWhitespace(streamText.charCodeAt(i)) && !isDelimiter(streamText.charCodeAt(i))) {
          i++;
        }
        const nameVal = streamText.slice(start, i);
        tokens.push({
          type: 'name',
          value: nameVal,
          raw: nameVal,
        });
        continue;
      }

      // 7. Numbers or Keywords/Operators
      const start = i;
      while (i < len && !isWhitespace(streamText.charCodeAt(i)) && !isDelimiter(streamText.charCodeAt(i))) {
        i++;
      }
      const word = streamText.slice(start, i);

      if (word === 'true' || word === 'false') {
        tokens.push({ type: 'boolean', value: word === 'true', raw: word });
      } else if (!isNaN(Number(word))) {
        tokens.push({ type: 'number', value: parseFloat(word), raw: word });
      } else {
        tokens.push({ type: 'operator', value: word, raw: word });
      }
    }

    return tokens;
  }

  /**
   * Groups a flat token stream into structured PostScript-style PDF operations.
   */
  static parseOperations(tokens: Token[]): StreamOperation[] {
    const operations: StreamOperation[] = [];
    let currentOperands: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'operator') {
        operations.push({
          opIndex: operations.length,
          operator: token.value as string,
          operands: currentOperands,
        });
        currentOperands = [];
      } else {
        currentOperands.push(token);
      }
    }

    return operations;
  }

  /**
   * Decodes hex string into UTF-8 or ASCII string.
   */
  static decodeHexString(hex: string): string {
    const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
    let res = '';
    for (let i = 0; i < clean.length; i += 2) {
      const byte = parseInt(clean.slice(i, i + 2), 16);
      if (!isNaN(byte)) {
        res += String.fromCharCode(byte);
      }
    }
    return res;
  }

  /**
   * Encodes a string into uppercase PDF hex format: <48656C6C6F>
   */
  static encodeToHexString(str: string): string {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      hex += code.toString(16).padStart(2, '0').toUpperCase();
    }
    return `<${hex}>`;
  }

  /**
   * Escapes a string for literal PDF string format: (Hello World)
   */
  static encodeToLiteralString(str: string): string {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    return `(${escaped})`;
  }

  /**
   * Extracts all text runs from parsed operations, tracking graphics state.
   */
  static extractTextRuns(operations: StreamOperation[], streamIndex: number = 0): ParsedTextRun[] {
    const runs: ParsedTextRun[] = [];

    const defaultState: GraphicsState = {
      fontResource: '',
      fontSize: 12,
      textMatrix: [1, 0, 0, 1, 0, 0],
      lineMatrix: [1, 0, 0, 1, 0, 0],
      ctm: [1, 0, 0, 1, 0, 0],
      fillColor: { r: 0, g: 0, b: 0 },
      strokeColor: { r: 0, g: 0, b: 0 },
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScale: 100,
      textLeading: 12,
      renderMode: 0,
    };

    let currentState: GraphicsState = { ...defaultState };
    const stateStack: GraphicsState[] = [];

    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx];
      const name = op.operator;
      const args = op.operands;

      // Graphics state save / restore
      if (name === 'q') {
        stateStack.push({ ...currentState });
      } else if (name === 'Q') {
        if (stateStack.length > 0) {
          currentState = stateStack.pop()!;
        }
      }

      // Font & Font Size: /FontName size Tf
      else if (name === 'Tf' && args.length >= 2) {
        currentState.fontResource = String(args[0].value || '');
        currentState.fontSize = Number(args[1].value) || 12;
      }

      // Colors
      else if (name === 'rg' && args.length >= 3) {
        currentState.fillColor = {
          r: Number(args[0].value) || 0,
          g: Number(args[1].value) || 0,
          b: Number(args[2].value) || 0,
        };
      } else if (name === 'g' && args.length >= 1) {
        const val = Number(args[0].value) || 0;
        currentState.fillColor = { r: val, g: val, b: val };
      } else if (name === 'k' && args.length >= 4) {
        const c = Number(args[0].value) || 0;
        const m = Number(args[1].value) || 0;
        const y = Number(args[2].value) || 0;
        const k = Number(args[3].value) || 0;
        currentState.fillColor = {
          r: (1 - c) * (1 - k),
          g: (1 - m) * (1 - k),
          b: (1 - y) * (1 - k),
        };
      }

      // Text Object boundaries
      else if (name === 'BT') {
        currentState.textMatrix = [1, 0, 0, 1, 0, 0];
        currentState.lineMatrix = [1, 0, 0, 1, 0, 0];
      } else if (name === 'ET') {
        // Text Object closed
      }

      // Text Matrices: a b c d e f Tm
      else if (name === 'Tm' && args.length >= 6) {
        const m = args.map((a) => Number(a.value) || 0);
        currentState.textMatrix = [...m];
        currentState.lineMatrix = [...m];
      }

      // Text displacement: tx ty Td
      else if (name === 'Td' && args.length >= 2) {
        const tx = Number(args[0].value) || 0;
        const ty = Number(args[1].value) || 0;
        currentState.lineMatrix[4] += tx;
        currentState.lineMatrix[5] += ty;
        currentState.textMatrix = [...currentState.lineMatrix];
      }

      // Character & Word spacing
      else if (name === 'Tc' && args.length >= 1) {
        currentState.charSpacing = Number(args[0].value) || 0;
      } else if (name === 'Tw' && args.length >= 1) {
        currentState.wordSpacing = Number(args[0].value) || 0;
      } else if (name === 'Tz' && args.length >= 1) {
        currentState.horizontalScale = Number(args[0].value) || 100;
      }

      // Text Showing Operators: Tj, TJ, ', "
      else if (name === 'Tj' || name === 'TJ' || name === "'" || name === '"') {
        let text = '';

        if (name === 'Tj' && args.length >= 1) {
          const first = args[0];
          if (first.type === 'hexstring') {
            text = this.decodeHexString(first.value);
          } else {
            text = String(first.value || '');
          }
        } else if (name === 'TJ' && args.length >= 1) {
          const arr = args[0].value as Token[];
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.type === 'string') {
                text += item.value;
              } else if (item.type === 'hexstring') {
                text += this.decodeHexString(item.value);
              }
            }
          }
        } else if (name === "'" && args.length >= 1) {
          const first = args[0];
          text = first.type === 'hexstring' ? this.decodeHexString(first.value) : String(first.value || '');
        }

        const runX = currentState.textMatrix[4];
        const runY = currentState.textMatrix[5];

        runs.push({
          opIndex: opIdx,
          streamIndex,
          operator: name as any,
          fontResource: currentState.fontResource,
          fontSize: currentState.fontSize,
          color: { ...currentState.fillColor },
          textMatrix: [...currentState.textMatrix],
          decodedText: text,
          rawOperands: [...args],
          x: runX,
          y: runY,
        });
      }
    }

    return runs;
  }

  /**
   * Replaces text in a specific operation in-place and serializes back to content stream string.
   */
  static serializeModifiedStream(
    operations: StreamOperation[],
    modifiedRuns: {
      opIndex: number;
      newText: string;
      newFontSize?: number;
      newColor?: { r: number; g: number; b: number };
    }[]
  ): string {
    const modMap = new Map<number, (typeof modifiedRuns)[0]>();
    for (const m of modifiedRuns) {
      modMap.set(m.opIndex, m);
    }

    const lines: string[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const mod = modMap.get(op.opIndex);

      if (!mod) {
        // Output original operation operands + operator
        const opStr = op.operands.map((t) => t.raw).join(' ');
        lines.push(opStr ? `${opStr} ${op.operator}` : op.operator);
        continue;
      }

      // Modifying this text operation in-place!
      const opName = op.operator;

      if (opName === 'Tj') {
        const firstArg = op.operands[0];
        let replacementRaw = '';
        if (firstArg && firstArg.type === 'hexstring') {
          replacementRaw = this.encodeToHexString(mod.newText);
        } else {
          replacementRaw = this.encodeToLiteralString(mod.newText);
        }
        lines.push(`${replacementRaw} Tj`);
      } else if (opName === 'TJ') {
        // In-place replacement inside TJ array
        const firstArg = op.operands[0];
        let useHex = false;
        if (firstArg && Array.isArray(firstArg.value)) {
          const hexItem = (firstArg.value as Token[]).find((t) => t.type === 'hexstring');
          if (hexItem) useHex = true;
        }

        const replacementItem = useHex
          ? this.encodeToHexString(mod.newText)
          : this.encodeToLiteralString(mod.newText);
        lines.push(`[ ${replacementItem} ] TJ`);
      } else {
        const replacementRaw = this.encodeToLiteralString(mod.newText);
        lines.push(`${replacementRaw} ${opName}`);
      }
    }

    return lines.join('\n');
  }
}
