import * as pdfjsLib from 'pdfjs-dist';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

export class ImageEngine {
  /**
   * Renders PDF pages to individual image blobs (PNG or JPEG).
   */
  static async renderPdfToImages(
    pdfBytes: Uint8Array,
    options: {
      format?: 'image/png' | 'image/jpeg';
      dpi?: number; // 72, 150, 300
      quality?: number; // 0 to 1
      pageIndices?: number[];
    } = {},
    onProgress?: (percent: number, message: string) => void
  ): Promise<Array<{ pageNumber: number; blob: Blob; dataUrl: string }>> {
    const format = options.format || 'image/png';
    const dpi = options.dpi || 150;
    const scale = dpi / 72;
    const quality = options.quality !== undefined ? options.quality : 0.92;

    onProgress?.(5, 'Loading PDF for image extraction...');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    const pagesToRender = options.pageIndices
      ? options.pageIndices.map((i) => i + 1)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

    const results: Array<{ pageNumber: number; blob: Blob; dataUrl: string }> = [];

    for (let i = 0; i < pagesToRender.length; i++) {
      const pageNum = pagesToRender[i];
      const percent = Math.round(10 + (i / pagesToRender.length) * 80);
      onProgress?.(percent, `Rendering page ${pageNum} at ${dpi} DPI...`);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const dataUrl = canvas.toDataURL(format, quality);
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), format, quality);
      });

      results.push({ pageNumber: pageNum, blob, dataUrl });

      // Clean canvas
      canvas.width = 0;
      canvas.height = 0;
    }

    onProgress?.(100, 'All pages rendered successfully!');
    return results;
  }

  /**
   * Resizes, converts, and optimizes an image file using browser Canvas.
   */
  static async processImage(
    file: File | Blob,
    options: {
      width?: number;
      height?: number;
      format?: 'image/png' | 'image/jpeg' | 'image/webp';
      quality?: number; // 0 to 1
      preserveAspectRatio?: boolean;
    }
  ): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
    const format = options.format || 'image/webp';
    const quality = options.quality !== undefined ? options.quality : 0.85;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let targetWidth = options.width || img.width;
        let targetHeight = options.height || img.height;

        if (options.preserveAspectRatio && options.width && !options.height) {
          targetHeight = Math.round(img.height * (options.width / img.width));
        } else if (options.preserveAspectRatio && options.height && !options.width) {
          targetWidth = Math.round(img.width * (options.height / img.height));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL(format, quality);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                dataUrl,
                width: targetWidth,
                height: targetHeight,
              });
            } else {
              reject(new Error('Failed to create image blob'));
            }
          },
          format,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image file'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Generates a QR code data URL.
   */
  static async generateQrCode(
    text: string,
    options: {
      width?: number;
      darkColor?: string;
      lightColor?: string;
      margin?: number;
    } = {}
  ): Promise<string> {
    return await QRCode.toDataURL(text, {
      width: options.width || 400,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff',
      },
    });
  }

  /**
   * Scans a QR code from an image or canvas.
   */
  static async scanQrFromImage(imageSource: HTMLImageElement | HTMLCanvasElement): Promise<string | null> {
    let canvas: HTMLCanvasElement;
    if (imageSource instanceof HTMLCanvasElement) {
      canvas = imageSource;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = imageSource.naturalWidth || imageSource.width;
      canvas.height = imageSource.naturalHeight || imageSource.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(imageSource, 0, 0);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    return code ? code.data : null;
  }
}
