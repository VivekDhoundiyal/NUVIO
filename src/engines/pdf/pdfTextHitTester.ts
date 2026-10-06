import type { PdfGlyph, PdfTextRun, PdfTextObject } from './pdfTextObjectModel';

export interface HitTestResult {
  textObject: PdfTextObject;
  run: PdfTextRun;
  glyph: PdfGlyph;
  glyphIndex: number;
  insertionIndex: number;
  distance: number;
}

export class PdfTextHitTester {
  /**
   * Performs sub-pixel hit-testing against extracted PdfTextObjects.
   * Coordinate (pdfX, pdfY) is in standard PDF user coordinates (72 DPI, origin bottom-left).
   */
  public static hitTest(
    textObjects: PdfTextObject[],
    pdfX: number,
    pdfY: number,
    tolerance: number = 8
  ): HitTestResult | null {
    let closestResult: HitTestResult | null = null;
    let closestDistance = Infinity;

    for (const txtObj of textObjects) {
      // Coarse bbox check with tolerance
      const bbox = txtObj.bbox;
      if (
        pdfX < bbox.x - tolerance ||
        pdfX > bbox.x + bbox.width + tolerance ||
        pdfY < bbox.y - tolerance ||
        pdfY > bbox.y + bbox.height + tolerance
      ) {
        continue;
      }

      for (const run of txtObj.runs) {
        for (let gIdx = 0; gIdx < run.glyphs.length; gIdx++) {
          const g = run.glyphs[gIdx];
          const gTop = g.y + g.height;
          const gBottom = g.y - g.height * 0.25;

          // Check if point is inside glyph box
          const insideX = pdfX >= g.x && pdfX <= g.x + g.width;
          const insideY = pdfY >= gBottom && pdfY <= gTop;

          let dist = 0;
          if (insideX && insideY) {
            dist = 0; // Exact hit
          } else {
            const dx = Math.max(0, g.x - pdfX, pdfX - (g.x + g.width));
            const dy = Math.max(0, gBottom - pdfY, pdfY - gTop);
            dist = Math.hypot(dx, dy);
          }

          if (dist < closestDistance && dist <= tolerance) {
            closestDistance = dist;
            // Check if cursor is on left or right half of the glyph
            const isRightHalf = pdfX > g.x + g.width * 0.5;
            const insertionIndex = isRightHalf ? gIdx + 1 : gIdx;

            closestResult = {
              textObject: txtObj,
              run,
              glyph: g,
              glyphIndex: gIdx,
              insertionIndex,
              distance: dist,
            };

            if (dist === 0) {
              return closestResult; // Direct hit
            }
          }
        }
      }
    }

    return closestResult;
  }
}
