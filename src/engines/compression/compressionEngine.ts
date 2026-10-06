import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

export type CompressionLevel = 'low' | 'medium' | 'high';

export interface CompressionResult {
  pdfBytes: Uint8Array;
  compressedBytes?: Uint8Array;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedBytes: number;
  percentageReduced: number;
}

export class CompressionEngine {
  /**
   * Compresses a PDF by downscaling and re-encoding page raster streams with honest byte tracking.
   */
  static async compressPdf(
    pdfBytes: Uint8Array,
    levelOrOptions: CompressionLevel | { level?: string; quality?: string } = 'medium',
    onProgress?: (percent: number, message: string) => void
  ): Promise<CompressionResult> {
    const originalSizeBytes = pdfBytes.byteLength;
    onProgress?.(5, 'Analyzing PDF document elements...');

    let level: CompressionLevel = 'medium';
    if (typeof levelOrOptions === 'object' && levelOrOptions !== null) {
      const lvl = (levelOrOptions as any).level || (levelOrOptions as any).quality;
      if (lvl === 'high' || lvl === 'maximum') level = 'high';
      else if (lvl === 'low' || lvl === 'light') level = 'low';
      else level = 'medium';
    } else if (typeof levelOrOptions === 'string') {
      if (levelOrOptions === 'high' || levelOrOptions === 'low') level = levelOrOptions;
      else level = 'medium';
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: '' });
    const srcPdfJs = await loadingTask.promise;
    const numPages = srcPdfJs.numPages;

    const newPdfDoc = await PDFDocument.create();

    const qualityConfig = {
      high: { scale: 1.0, quality: 0.5 },    // Maximum compression
      medium: { scale: 1.35, quality: 0.7 }, // Balanced compression
      low: { scale: 1.8, quality: 0.85 },    // High visual fidelity
    }[level];

    // In non-browser / headless test environments without DOM document
    if (typeof document === 'undefined') {
      const loadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const optimizedBytes = await loadedDoc.save({ useObjectStreams: true });
      return {
        pdfBytes: optimizedBytes,
        compressedBytes: optimizedBytes,
        originalSizeBytes,
        compressedSizeBytes: optimizedBytes.byteLength,
        savedBytes: Math.max(0, originalSizeBytes - optimizedBytes.byteLength),
        percentageReduced: Math.round(
          Math.max(0, (originalSizeBytes - optimizedBytes.byteLength) / originalSizeBytes) * 100
        ),
      };
    }

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const progressPercent = Math.round(10 + (pageNum / numPages) * 75);
      onProgress?.(progressPercent, `Optimizing page ${pageNum} of ${numPages}...`);

      const page = await srcPdfJs.getPage(pageNum);
      const viewport = page.getViewport({ scale: qualityConfig.scale });
      const origViewport = page.getViewport({ scale: 1.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert to compressed JPEG data URL
      const compressedDataUrl = canvas.toDataURL('image/jpeg', qualityConfig.quality);
      const embeddedImage = await newPdfDoc.embedJpg(compressedDataUrl);

      // Add page with original dimensions to preserve physical layout
      const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height,
      });

      // Cleanup canvas memory
      canvas.width = 0;
      canvas.height = 0;
    }

    onProgress?.(90, 'Packaging optimized PDF binary...');
    const compressedBytes = await newPdfDoc.save();
    const compressedSizeBytes = compressedBytes.byteLength;

    const savedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
    const percentageReduced = Math.round((savedBytes / originalSizeBytes) * 100);

    onProgress?.(100, 'Optimization complete!');

    return {
      pdfBytes: compressedBytes,
      compressedBytes,
      originalSizeBytes,
      compressedSizeBytes,
      savedBytes,
      percentageReduced,
    };
  }
}
