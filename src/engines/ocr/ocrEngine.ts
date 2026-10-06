import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

export class OcrEngine {
  private static activeWorker: Worker | null = null;

  /**
   * Recognizes text from an image or canvas.
   */
  static async recognizeImage(
    imageSource: string | HTMLCanvasElement | File | Blob,
    lang = 'eng',
    onProgress?: (progressPercent: number, statusText: string) => void
  ): Promise<string> {
    const worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status && typeof m.progress === 'number') {
          const percent = Math.round(m.progress * 100);
          onProgress?.(percent, `${m.status} (${percent}%)`);
        }
      },
    });

    this.activeWorker = worker;

    try {
      const ret = await worker.recognize(imageSource);
      return ret.data.text;
    } finally {
      await worker.terminate();
      this.activeWorker = null;
    }
  }

  /**
   * Recognizes text and line bounding boxes from an image or canvas.
   */
  static async recognizeLines(
    imageSource: string | HTMLCanvasElement | File | Blob,
    lang = 'eng'
  ): Promise<{ text: string; lines: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; fontSize: number }> }> {
    const worker = await createWorker(lang, 1);
    this.activeWorker = worker;
    try {
      const ret = await worker.recognize(imageSource);
      const lines = ((ret.data as any).lines || [])
        .map((l: any) => ({
          text: l.text ? l.text.trim() : '',
          bbox: l.bbox || { x0: 0, y0: 0, x1: 100, y1: 20 },
          fontSize: l.font_size || 16,
        }))
        .filter((l: any) => l.text.length > 0);

      return {
        text: ret.data.text,
        lines,
      };
    } finally {
      await worker.terminate();
      this.activeWorker = null;
    }
  }

  /**
   * Recognizes text from a multi-page PDF document by rendering pages to high-res offscreen canvases.
   */
  static async recognizePdf(
    pdfBytes: Uint8Array,
    lang = 'eng',
    onProgress?: (progressPercent: number, statusText: string) => void
  ): Promise<{ fullText: string; pageTexts: string[] }> {
    onProgress?.(5, 'Loading PDF for OCR...');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: '' });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status && typeof m.progress === 'number') {
          // Inner progress
        }
      },
    });

    this.activeWorker = worker;
    const pageTexts: string[] = [];

    try {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const basePercent = Math.round(10 + ((pageNum - 1) / numPages) * 85);
        onProgress?.(basePercent, `Processing page ${pageNum} of ${numPages}...`);

        const page = await pdfDoc.getPage(pageNum);
        // Render at 2.0 scale (approx 144 DPI) for accurate OCR recognition
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const ret = await worker.recognize(canvas);
        pageTexts.push(ret.data.text);

        // Memory cleanup
        canvas.width = 0;
        canvas.height = 0;
      }

      onProgress?.(100, 'OCR completed successfully!');
      return {
        fullText: pageTexts.join('\n\n--- Page Break ---\n\n'),
        pageTexts,
      };
    } finally {
      await worker.terminate();
      this.activeWorker = null;
    }
  }

  /**
   * Cancels any active OCR job.
   */
  static async cancel(): Promise<void> {
    if (this.activeWorker) {
      await this.activeWorker.terminate();
      this.activeWorker = null;
    }
  }
}
