import type { Matrix2D, RgbColor, PdfGraphicsStateSnapshot } from './pdfGraphicsState';

/**
 * A discrete single glyph instance extracted from a PDF content stream.
 * Contains exact spatial coordinates, font binding, character code, and styling.
 */
export interface PdfGlyph {
  id: string;
  char: string;
  code: number; // Raw byte code or CID
  rawBytes: Uint8Array;
  x: number; // PDF page coordinate (72 DPI, origin bottom-left)
  y: number; // Baseline PDF page coordinate
  width: number; // Metric width in points
  height: number; // Font size / bbox height
  fontResource: string; // e.g. '/F1', '/TT0'
  fontSize: number;
  fillColor: RgbColor;
  strokeColor: RgbColor;
  fillAlpha: number;
  charSpacing: number;
  wordSpacing: number;
  horizontalScale: number;
  textMatrix: Matrix2D;
  ctm: Matrix2D;
  opIndex: number;
  streamIndex: number;
  operandIndex: number; // Array element index if TJ, 0 if Tj
  charIndexInOperand: number; // Byte index within the string operand
  isModified: boolean;
}

/**
 * A continuous text run emitted by a single text-showing operator (Tj or element of TJ).
 */
export interface PdfTextRun {
  id: string;
  opIndex: number;
  streamIndex: number;
  operator: 'Tj' | 'TJ' | "'" | '"';
  operandIndex: number; // 0 for Tj, index in array for TJ
  text: string;
  decodedText: string;
  glyphs: PdfGlyph[];
  x: number;
  y: number;
  width: number;
  height: number;
  fontResource: string;
  fontSize: number;
  fillColor: RgbColor;
  strokeColor: RgbColor;
  graphicsState: PdfGraphicsStateSnapshot;
  rawOperandText: string;
  isHexString: boolean;
  isModified: boolean;
}

/**
 * A complete text object bounded by BT (Begin Text) and ET (End Text).
 */
export interface PdfTextObject {
  id: string;
  pageIndex: number;
  streamIndex: number;
  startOpIndex: number; // BT index
  endOpIndex: number; // ET index
  runs: PdfTextRun[];
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
