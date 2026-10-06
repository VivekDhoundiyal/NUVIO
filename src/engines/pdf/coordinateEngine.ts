/**
 * Unified Coordinate Engine for PDF User Space <-> Screen Space Transformations
 *
 * PDF User Space:
 * - 72 points per inch (DPI)
 * - Origin (0, 0) is at Bottom-Left by default
 * - Y increases UPWARD
 *
 * Screen Space (DOM / HTML5 Canvas):
 * - Device / CSS pixels scaled by zoom factor (0.5x to 4.0x)
 * - Origin (0, 0) is at Top-Left
 * - Y increases DOWNWARD
 *
 * Page Rotation:
 * - 0°, 90°, 180°, 270° clockwise
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CoordinateEngine {
  /**
   * Converts a PDF user space point (bottom-left origin) to screen DOM coordinates (top-left origin).
   */
  static pdfPointToScreen(
    pdfX: number,
    pdfY: number,
    pageWidth: number,
    pageHeight: number,
    zoom: number,
    rotation: number = 0
  ): Point2D {
    const rot = ((rotation % 360) + 360) % 360;

    let localX = pdfX;
    let localY = pageHeight - pdfY; // Invert Y to top-left origin

    if (rot === 90) {
      const rx = localY;
      const ry = pageWidth - localX;
      return { x: rx * zoom, y: ry * zoom };
    } else if (rot === 180) {
      const rx = pageWidth - localX;
      const ry = pageHeight - localY;
      return { x: rx * zoom, y: ry * zoom };
    } else if (rot === 270) {
      const rx = pageHeight - localY;
      const ry = localX;
      return { x: rx * zoom, y: ry * zoom };
    }

    return { x: localX * zoom, y: localY * zoom };
  }

  /**
   * Converts a Screen DOM coordinate (top-left origin) to PDF user space point (bottom-left origin).
   */
  static screenPointToPdf(
    screenX: number,
    screenY: number,
    pageWidth: number,
    pageHeight: number,
    zoom: number,
    rotation: number = 0
  ): Point2D {
    const unscaledX = screenX / zoom;
    const unscaledY = screenY / zoom;
    const rot = ((rotation % 360) + 360) % 360;

    let localX = unscaledX;
    let localY = unscaledY;

    if (rot === 90) {
      localX = pageWidth - unscaledY;
      localY = unscaledX;
    } else if (rot === 180) {
      localX = pageWidth - unscaledX;
      localY = pageHeight - unscaledY;
    } else if (rot === 270) {
      localX = unscaledY;
      localY = pageHeight - unscaledX;
    }

    const pdfX = localX;
    const pdfY = pageHeight - localY;
    return { x: pdfX, y: pdfY };
  }

  /**
   * Converts a PDF rectangle to Screen bounding box.
   */
  static pdfRectToScreen(
    rect: Rect2D,
    pageWidth: number,
    pageHeight: number,
    zoom: number,
    rotation: number = 0
  ): Rect2D {
    // In PDF space, rect.y is usually baseline or bottom of rect.
    // Top-left in PDF coordinates: (rect.x, rect.y + rect.height)
    const pTopLeft = this.pdfPointToScreen(
      rect.x,
      rect.y + rect.height,
      pageWidth,
      pageHeight,
      zoom,
      rotation
    );

    const rot = ((rotation % 360) + 360) % 360;
    if (rot === 90 || rot === 270) {
      return {
        x: pTopLeft.x,
        y: pTopLeft.y,
        width: rect.height * zoom,
        height: rect.width * zoom,
      };
    }

    return {
      x: pTopLeft.x,
      y: pTopLeft.y,
      width: rect.width * zoom,
      height: rect.height * zoom,
    };
  }

  /**
   * Converts a Screen bounding box to PDF rectangle.
   */
  static screenRectToPdf(
    rect: Rect2D,
    pageWidth: number,
    pageHeight: number,
    zoom: number,
    rotation: number = 0
  ): Rect2D {
    const pPdfBottomLeft = this.screenPointToPdf(
      rect.x,
      rect.y + rect.height,
      pageWidth,
      pageHeight,
      zoom,
      rotation
    );

    const rot = ((rotation % 360) + 360) % 360;
    const unscaledW = rect.width / zoom;
    const unscaledH = rect.height / zoom;

    if (rot === 90 || rot === 270) {
      return {
        x: pPdfBottomLeft.x,
        y: pPdfBottomLeft.y,
        width: unscaledH,
        height: unscaledW,
      };
    }

    return {
      x: pPdfBottomLeft.x,
      y: pPdfBottomLeft.y,
      width: unscaledW,
      height: unscaledH,
    };
  }

  /**
   * Snaps an angle to given step (default 15 degrees).
   */
  static snapAngle(angleDeg: number, stepDeg: number = 15): number {
    const normalized = ((angleDeg % 360) + 360) % 360;
    return Math.round(normalized / stepDeg) * stepDeg % 360;
  }

  /**
   * Rotates a 2D point around a center.
   */
  static rotatePoint(
    x: number,
    y: number,
    cx: number,
    cy: number,
    angleDeg: number
  ): Point2D {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + (dx * cos - dy * sin),
      y: cy + (dx * sin + dy * cos),
    };
  }
}
