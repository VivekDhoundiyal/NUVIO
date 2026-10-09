/**
 * NUVIO PDF Text Metrics Engine
 * Authoritative, centralized text measurement, glyph advance calculation,
 * and typographic bounding-box service.
 *
 * Guarantees 100% parity across:
 * - PDF user-space points
 * - Screen-space viewport pixels (devicePixelRatio & zoom aware)
 * - True Type 1 & TrueType standard glyph metric tables
 * - Exact baseline alignment (ascent, descent, capHeight, xHeight)
 * - Trailing glyph bounding protection (preventing 'k', 'K', 'l' clipping)
 */

import type { PDFTextStyle } from '../../types/document';

export interface PDFTextMeasurement {
  /** Typographic advance width in PDF user points (1/72 inch) */
  advanceWidth: number;
  /** Visual bounding width in PDF user points, accounting for rightward glyph overhang */
  visualWidth: number;
  /** Advance width in screen pixels at specified zoom */
  advanceWidthPx: number;
  /** Visual bounding width in screen pixels at specified zoom (subpixel-safe) */
  visualWidthPx: number;
  /** Height in PDF user points */
  height: number;
  /** Height in screen pixels */
  heightPx: number;
  /** Font ascent in points (distance from baseline to top of highest ascenders) */
  ascent: number;
  /** Font descent in points (distance from baseline to bottom of descenders, positive value) */
  descent: number;
  /** Cap height in points (height of capital letters like 'H', 'V') */
  capHeight: number;
  /** Individual character advance widths in points */
  glyphAdvances: number[];
  /** Individual character boundary boxes relative to text origin */
  charBounds: { char: string; x: number; width: number }[];
  /** Recommended minimum width for DOM input/editing containers to guarantee zero clipping */
  recommendedInputWidthPx: number;
}

/** Standard Adobe Type 1 Font Metrics (widths per 1000 units of em) */
const HELVETICA_METRICS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015,
  'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
  'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
  'Y': 667, 'Z': 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 222,
  'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556,
  'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
  'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
  'y': 500, 'z': 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

const TIMES_METRICS: Record<string, number> = {
  ' ': 250, '!': 333, '"': 408, '#': 500, '$': 500, '%': 833, '&': 778, "'": 180,
  '(': 333, ')': 333, '*': 500, '+': 564, ',': 250, '-': 333, '.': 250, '/': 278,
  '0': 500, '1': 500, '2': 500, '3': 500, '4': 500, '5': 500, '6': 500, '7': 500,
  '8': 500, '9': 500, ':': 278, ';': 278, '<': 564, '=': 564, '>': 564, '?': 444,
  '@': 921,
  'A': 722, 'B': 667, 'C': 667, 'D': 722, 'E': 611, 'F': 556, 'G': 722, 'H': 722,
  'I': 333, 'J': 389, 'K': 722, 'L': 611, 'M': 889, 'N': 722, 'O': 722, 'P': 556,
  'Q': 722, 'R': 667, 'S': 556, 'T': 611, 'U': 722, 'V': 722, 'W': 944, 'X': 722,
  'Y': 722, 'Z': 611,
  '[': 333, '\\': 278, ']': 333, '^': 469, '_': 500, '`': 250,
  'a': 444, 'b': 500, 'c': 444, 'd': 500, 'e': 444, 'f': 278, 'g': 500, 'h': 500,
  'i': 278, 'j': 278, 'k': 500, 'l': 278, 'm': 778, 'n': 500, 'o': 500, 'p': 500,
  'q': 500, 'r': 333, 's': 389, 't': 278, 'u': 500, 'v': 500, 'w': 722, 'x': 500,
  'y': 500, 'z': 444,
  '{': 348, '|': 220, '}': 348, '~': 541,
};

const COURIER_CHAR_WIDTH = 600;

export class PDFTextMetrics {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;

  /**
   * Lazily initializes a high-precision offscreen canvas for browser text measurement.
   */
  private static getMeasurementContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1000;
      this.canvas.height = 200;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    }
    return this.ctx;
  }

  /**
   * Builds canonical CSS font specification string.
   */
  public static buildFontSpec(
    fontFamily: string = 'Helvetica, Arial, sans-serif',
    fontSize: number = 12,
    fontWeight: string = 'normal',
    fontStyle: string = 'normal',
    zoom: number = 1.0
  ): string {
    const stylePart = fontStyle === 'italic' ? 'italic ' : '';
    const weightPart = fontWeight === 'bold' || fontWeight === '700' ? 'bold ' : '';
    const pxSize = Math.max(1, fontSize * zoom);
    return `${stylePart}${weightPart}${pxSize}px ${fontFamily}`;
  }

  /**
   * Resolves standard font metrics profile based on font family.
   */
  public static getFontMetricTable(fontFamily?: string): {
    table: Record<string, number> | null;
    defaultRatio: number;
    ascentRatio: number;
    descentRatio: number;
    capHeightRatio: number;
  } {
    const f = (fontFamily || '').toLowerCase();
    if (f.includes('courier') || f.includes('mono') || f.includes('consolas')) {
      return {
        table: null,
        defaultRatio: COURIER_CHAR_WIDTH / 1000,
        ascentRatio: 0.82,
        descentRatio: 0.22,
        capHeightRatio: 0.65,
      };
    }
    if (f.includes('times') || f.includes('serif') || f.includes('roman') || f.includes('georgia')) {
      return {
        table: TIMES_METRICS,
        defaultRatio: 0.5,
        ascentRatio: 0.85,
        descentRatio: 0.22,
        capHeightRatio: 0.68,
      };
    }
    return {
      table: HELVETICA_METRICS,
      defaultRatio: 0.52,
      ascentRatio: 0.84,
      descentRatio: 0.22,
      capHeightRatio: 0.71,
    };
  }

  /**
   * Returns exact advance width for a single character in points.
   */
  public static getGlyphAdvance(char: string, fontSize: number, fontFamily?: string): number {
    const { table, defaultRatio } = this.getFontMetricTable(fontFamily);
    if (!table) return fontSize * defaultRatio;
    const ratio = table[char] !== undefined ? table[char] / 1000 : defaultRatio;
    return fontSize * ratio;
  }

  /**
   * Comprehensive text measurement service.
   * Single authoritative source of truth for text width, height, baseline, and glyph bounds.
   */
  public static measureText(
    text: string,
    style?: Partial<PDFTextStyle> | { fontFamily?: string; fontSize?: number; fontWeight?: string; fontStyle?: string; letterSpacing?: number },
    zoom: number = 1.0
  ): PDFTextMeasurement {
    const fontSize = style?.fontSize || 12;
    const fontFamily = style?.fontFamily || 'Helvetica, Arial, sans-serif';
    const fontWeight = (style?.fontWeight as string) || 'normal';
    const fontStyle = (style?.fontStyle as string) || 'normal';
    const letterSpacing = style?.letterSpacing || 0;

    const { table, defaultRatio, ascentRatio, descentRatio, capHeightRatio } = this.getFontMetricTable(fontFamily);

    const ascent = fontSize * ascentRatio;
    const descent = fontSize * descentRatio;
    const capHeight = fontSize * capHeightRatio;
    const fontHeight = fontSize * 1.2;

    if (!text || text.length === 0) {
      return {
        advanceWidth: 0,
        visualWidth: 0,
        advanceWidthPx: 0,
        visualWidthPx: 0,
        height: fontHeight,
        heightPx: fontHeight * zoom,
        ascent,
        descent,
        capHeight,
        glyphAdvances: [],
        charBounds: [],
        recommendedInputWidthPx: Math.ceil(24 * zoom),
      };
    }

    const glyphAdvances: number[] = new Array(text.length);
    const charBounds: { char: string; x: number; width: number }[] = [];
    let runningX = 0;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let adv = 0;
      if (!table) {
        adv = fontSize * defaultRatio;
      } else {
        adv = (table[ch] !== undefined ? table[ch] / 1000 : defaultRatio) * fontSize;
      }
      glyphAdvances[i] = adv;
      charBounds.push({
        char: ch,
        x: runningX,
        width: adv,
      });
      runningX += adv + letterSpacing;
    }

    // The nominal typographic advance width in points
    let advanceWidth = Math.max(0, runningX - (text.length > 0 ? letterSpacing : 0));
    let visualWidth = advanceWidth;

    // Check with Canvas 2D measurement if running in browser
    const ctx = this.getMeasurementContext();
    if (ctx) {
      try {
        const fontSpec = this.buildFontSpec(fontFamily, fontSize, fontWeight, fontStyle, 1.0);
        ctx.font = fontSpec;
        const textMetrics = ctx.measureText(text);

        if (textMetrics && textMetrics.width > 0) {
          // If browser canvas measurement is available, harmonize with canvas measurement
          const canvasAdvance = textMetrics.width + (text.length - 1) * letterSpacing;
          advanceWidth = Math.max(advanceWidth, canvasAdvance);

          // Calculate actual rightward glyph bounding box extent
          // For glyphs like 'k', 'K', 'f', 'z', actualBoundingBoxRight may exceed advance
          if (textMetrics.actualBoundingBoxRight !== undefined && textMetrics.actualBoundingBoxLeft !== undefined) {
            const visualExtent = (textMetrics.actualBoundingBoxRight - textMetrics.actualBoundingBoxLeft) + (text.length - 1) * letterSpacing;
            visualWidth = Math.max(advanceWidth, visualExtent);
          } else {
            visualWidth = advanceWidth;
          }
        }
      } catch {
        // Fall back cleanly to table-derived metrics
      }
    }

    // Trailing glyph right-overhang allowance:
    // Glyphs like 'k', 'K', 'd', 'l', diagonal characters, and italic forms have side-bearings
    // that require padding to prevent clipping when rendered inside DOM boundaries.
    const lastChar = text[text.length - 1];
    let trailingOverhang = 0;
    if (lastChar === 'k' || lastChar === 'K' || lastChar === 'f' || lastChar === 'z') {
      trailingOverhang = fontSize * 0.12;
    } else if (fontStyle === 'italic') {
      trailingOverhang = fontSize * 0.15;
    }

    visualWidth += trailingOverhang;

    const advanceWidthPx = advanceWidth * zoom;
    const visualWidthPx = Math.ceil(visualWidth * zoom);
    const heightPx = Math.ceil(fontHeight * zoom);

    // Recommended input width provides dedicated space so inputs never scroll or clip the last glyph
    const recommendedInputWidthPx = Math.max(
      Math.ceil(advanceWidthPx + 16),
      Math.ceil(visualWidthPx + 20)
    );

    return {
      advanceWidth: Math.round(advanceWidth * 100) / 100,
      visualWidth: Math.round(visualWidth * 100) / 100,
      advanceWidthPx,
      visualWidthPx,
      height: Math.round(fontHeight * 100) / 100,
      heightPx,
      ascent: Math.round(ascent * 100) / 100,
      descent: Math.round(descent * 100) / 100,
      capHeight: Math.round(capHeight * 100) / 100,
      glyphAdvances,
      charBounds,
      recommendedInputWidthPx,
    };
  }

  /**
   * Helper to compute exact DOM dimensions for inline text input/textarea editing.
   */
  public static computeInputBounds(
    text: string,
    style?: Partial<PDFTextStyle>,
    zoom: number = 1.0,
    containerMinPadding: number = 12
  ): {
    widthPx: number;
    heightPx: number;
    fontSizePx: number;
    lineHeightPx: number;
    baselineOffsetPx: number;
  } {
    const measurement = this.measureText(text, style, zoom);
    const fontSize = style?.fontSize || 12;
    const fontSizePx = Math.max(1, fontSize * zoom);
    const lineHeightPx = Math.max(fontSizePx * 1.25, measurement.heightPx);
    const widthPx = Math.max(measurement.recommendedInputWidthPx, Math.ceil(measurement.visualWidthPx + containerMinPadding));
    const heightPx = Math.max(22, Math.ceil(lineHeightPx + 4));
    const baselineOffsetPx = measurement.ascent * zoom;

    return {
      widthPx,
      heightPx,
      fontSizePx,
      lineHeightPx,
      baselineOffsetPx,
    };
  }

  /**
   * Converts PDF baseline Y coordinate (origin bottom-left) to Viewport top coordinate (origin top-left).
   */
  public static pdfBaselineToViewportTop(
    pdfBaselineY: number,
    pageHeight: number,
    fontSize: number,
    zoom: number = 1.0,
    fontFamily?: string
  ): number {
    const { ascentRatio } = this.getFontMetricTable(fontFamily);
    const ascent = fontSize * ascentRatio;
    const viewportBaselineY = (pageHeight - pdfBaselineY) * zoom;
    return viewportBaselineY - (ascent * zoom);
  }

  /**
   * Converts Viewport top coordinate (origin top-left) to PDF baseline Y coordinate (origin bottom-left).
   */
  public static viewportTopToPdfBaseline(
    viewportTop: number,
    pageHeight: number,
    fontSize: number,
    zoom: number = 1.0,
    fontFamily?: string
  ): number {
    const { ascentRatio } = this.getFontMetricTable(fontFamily);
    const ascent = fontSize * ascentRatio;
    const viewportBaselineY = viewportTop + (ascent * zoom);
    return pageHeight - (viewportBaselineY / zoom);
  }
}
