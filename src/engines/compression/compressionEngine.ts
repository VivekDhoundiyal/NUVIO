import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

export type CompressionLevel = 'recommended' | 'high' | 'balanced' | 'low' | 'medium';

export interface CompressionResult {
  pdfBytes: Uint8Array;
  compressedBytes?: Uint8Array;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savedBytes: number;
  percentageReduced: number;
  isAlreadyOptimized?: boolean;
}

export class CompressionEngine {
  /**
   * Compresses a PDF by downscaling and re-encoding page raster streams with honest byte tracking.
   */
  static async compressPdf(
    pdfBytes: Uint8Array,
    levelOrOptions: CompressionLevel | { level?: string; quality?: string } = 'recommended',
    onProgress?: (percent: number, message: string) => void
  ): Promise<CompressionResult> {
    const originalSizeBytes = pdfBytes.byteLength;
    onProgress?.(5, 'Analyzing PDF document elements...');

    let level: 'recommended' | 'high' | 'balanced' | 'low' = 'recommended';
    let rawLevel = typeof levelOrOptions === 'object' && levelOrOptions !== null
      ? (levelOrOptions as any).level || (levelOrOptions as any).quality
      : levelOrOptions;

    if (rawLevel === 'high' || rawLevel === 'maximum') {
      level = 'high';
    } else if (rawLevel === 'balanced') {
      level = 'balanced';
    } else if (rawLevel === 'low' || rawLevel === 'light' || rawLevel === 'high-quality') {
      level = 'low';
    } else {
      level = 'recommended';
    }

    const qualityConfig = {
      high: { scale: 1.0, quality: 0.50 },        // High Compression (email attachments)
      balanced: { scale: 1.20, quality: 0.60 },    // Balanced
      recommended: { scale: 1.35, quality: 0.70 }, // Recommended (optimal clarity/size)
      low: { scale: 1.80, quality: 0.85 },        // High Quality (preserves maximum clarity)
    }[level];

    // Try object stream optimization as baseline
    let objectStreamBytes: Uint8Array | null = null;
    try {
      const loadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      objectStreamBytes = await loadedDoc.save({ useObjectStreams: true });
    } catch {
      // Continue if non-standard encryption
    }

    // In non-browser / headless test environments without DOM document
    if (typeof document === 'undefined') {
      const optimizedBytes = objectStreamBytes || pdfBytes;
      const finalBytes = optimizedBytes.byteLength < originalSizeBytes ? optimizedBytes : pdfBytes;
      const saved = Math.max(0, originalSizeBytes - finalBytes.byteLength);
      return {
        pdfBytes: finalBytes,
        compressedBytes: finalBytes,
        originalSizeBytes,
        compressedSizeBytes: finalBytes.byteLength,
        savedBytes: saved,
        percentageReduced: Math.round((saved / originalSizeBytes) * 100),
        isAlreadyOptimized: saved === 0,
      };
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: '' });
    const srcPdfJs = await loadingTask.promise;
    const numPages = srcPdfJs.numPages;

    const newPdfDoc = await PDFDocument.create();

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
    const rasterCompressedBytes = await newPdfDoc.save();
    
    // Pick the best compression candidate between raster downsampling and object-stream compaction
    let finalBytes = rasterCompressedBytes;
    if (objectStreamBytes && objectStreamBytes.byteLength < finalBytes.byteLength) {
      finalBytes = objectStreamBytes;
    }

    // Never inflate: If optimized output is larger than original, preserve original bytes
    if (finalBytes.byteLength > originalSizeBytes) {
      finalBytes = objectStreamBytes && objectStreamBytes.byteLength <= originalSizeBytes ? objectStreamBytes : pdfBytes;
    }

    const compressedSizeBytes = finalBytes.byteLength;
    const savedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
    const percentageReduced = Math.round((savedBytes / originalSizeBytes) * 100);

    onProgress?.(100, 'Optimization complete!');

    return {
      pdfBytes: finalBytes,
      compressedBytes: finalBytes,
      originalSizeBytes,
      compressedSizeBytes,
      savedBytes,
      percentageReduced,
      isAlreadyOptimized: savedBytes === 0,
    };
  }
}
