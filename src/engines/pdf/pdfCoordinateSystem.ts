/**
 * Canonical PDF Coordinate Transformation System
 *
 * PDF User Space:
 * - 72 points per inch (DPI)
 * - Origin (0, 0) is at Bottom-Left of the CropBox/MediaBox
 * - X increases rightward, Y increases UPWARD
 *
 * Viewport Space (DOM / Canvas within Page container):
 * - Origin (0, 0) is at Top-Left of the rendered page element
 * - X increases rightward, Y increases DOWNWARD
 * - Scaled by zoom factor (e.g. 1.0, 1.5)
 *
 * Screen Space (Global window / client coordinates):
 * - Viewport coordinates plus container scroll / client bounding rect offsets
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

export interface PageGeometry {
  width: number; // PDF points
  height: number; // PDF points
  rotation?: number; // 0, 90, 180, 270
  cropBox?: [number, number, number, number]; // [minX, minY, maxX, maxY]
  mediaBox?: [number, number, number, number];
}

export class PdfCoordinateSystem {
  /**
   * Transforms a PDF user coordinate (origin bottom-left, +Y up)
   * into page viewport coordinates (origin top-left, +Y down, scaled by zoom).
   */
  public static pdfToViewport(
    pdfX: number,
    pdfY: number,
    width: number,
    height: number,
    page: PageGeometry,
    zoom: number = 1.0
  ): Rect2D {
    const rot = ((page.rotation || 0) % 360 + 360) % 360;
    const cropX = page.cropBox ? page.cropBox[0] : 0;
    const cropY = page.cropBox ? page.cropBox[1] : 0;
    const pageW = page.width;
    const pageH = page.height;

    // Normal bottom-left to top-left inverted local points
    const localX = pdfX - cropX;
    // In PDF space, (pdfY) is bottom, so top of the box is (pdfY + height).
    // In viewport space, top is (pageH - (pdfY - cropY + height))
    const localY = pageH - (pdfY - cropY + height);

    if (rot === 90) {
      // 90° clockwise rotation:
      // X' = localY, Y' = pageW - (localX + width)
      return {
        x: (pageH - (pdfY - cropY + height)) * zoom,
        y: (pageW - (localX + width)) * zoom,
        width: height * zoom,
        height: width * zoom,
      };
    } else if (rot === 180) {
      // 180° rotation:
      return {
        x: (pageW - (localX + width)) * zoom,
        y: (pdfY - cropY) * zoom,
        width: width * zoom,
        height: height * zoom,
      };
    } else if (rot === 270) {
      // 270° clockwise:
      return {
        x: (pdfY - cropY) * zoom,
        y: localX * zoom,
        width: height * zoom,
        height: width * zoom,
      };
    }

    // Default 0° rotation
    return {
      x: localX * zoom,
      y: localY * zoom,
      width: width * zoom,
      height: height * zoom,
    };
  }

  /**
   * Transforms a viewport coordinate (origin top-left, scaled by zoom)
   * back into canonical PDF user coordinates (origin bottom-left, +Y up).
   */
  public static viewportToPdf(
    vx: number,
    vy: number,
    vWidth: number,
    vHeight: number,
    page: PageGeometry,
    zoom: number = 1.0
  ): Rect2D {
    const rot = ((page.rotation || 0) % 360 + 360) % 360;
    const cropX = page.cropBox ? page.cropBox[0] : 0;
    const cropY = page.cropBox ? page.cropBox[1] : 0;
    const pageW = page.width;
    const pageH = page.height;

    const unscaledX = vx / zoom;
    const unscaledY = vy / zoom;
    const unscaledW = vWidth / zoom;
    const unscaledH = vHeight / zoom;

    if (rot === 90) {
      const pdfWidth = unscaledH;
      const pdfHeight = unscaledW;
      const pdfX = cropX + pageW - unscaledY - pdfWidth;
      const pdfY = cropY + pageH - unscaledX - pdfHeight;
      return { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
    } else if (rot === 180) {
      const pdfWidth = unscaledW;
      const pdfHeight = unscaledH;
      const pdfX = cropX + pageW - unscaledX - pdfWidth;
      const pdfY = cropY + unscaledY;
      return { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
    } else if (rot === 270) {
      const pdfWidth = unscaledH;
      const pdfHeight = unscaledW;
      const pdfX = cropX + unscaledY;
      const pdfY = cropY + unscaledX;
      return { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
    }

    // Default 0°
    const pdfX = cropX + unscaledX;
    const pdfY = cropY + pageH - unscaledY - unscaledH;
    return {
      x: pdfX,
      y: pdfY,
      width: unscaledW,
      height: unscaledH,
    };
  }

  /**
   * Transforms a PDF coordinate to screen client coordinates
   * by applying container scroll and bounding client rect offsets.
   */
  public static pdfToScreen(
    pdfX: number,
    pdfY: number,
    width: number,
    height: number,
    page: PageGeometry,
    zoom: number = 1.0,
    containerRect: { left: number; top: number } = { left: 0, top: 0 }
  ): Rect2D {
    const v = this.pdfToViewport(pdfX, pdfY, width, height, page, zoom);
    return {
      x: v.x + containerRect.left,
      y: v.y + containerRect.top,
      width: v.width,
      height: v.height,
    };
  }

  /**
   * Transforms screen client coordinates back to canonical PDF coordinates.
   */
  public static screenToPdf(
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    page: PageGeometry,
    zoom: number = 1.0,
    containerRect: { left: number; top: number } = { left: 0, top: 0 }
  ): Rect2D {
    const vx = screenX - containerRect.left;
    const vy = screenY - containerRect.top;
    return this.viewportToPdf(vx, vy, width, height, page, zoom);
  }
}
