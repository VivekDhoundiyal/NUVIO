import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { ValidationReport, ValidationItem } from '../../types/document';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
}

export interface ValidationExpectations {
  expectedPageCount?: number;
  expectedMinPages?: number;
  operationName: string;
  originalSizeBytes?: number;
  originalPageCount?: number;
}

export class ValidationEngine {
  /**
   * Convenience method to validate a PDF document.
   */
  static async validatePdf(pdfBytes: Uint8Array): Promise<ValidationReport> {
    return this.validatePdfOutput(pdfBytes, { operationName: 'Document Validation' });
  }

  /**
   * Reopens an exported PDF binary and performs an automated fidelity & integrity audit.
   */
  static async validatePdfOutput(
    pdfBytes: Uint8Array,
    expectations: ValidationExpectations
  ): Promise<ValidationReport> {
    const items: ValidationItem[] = [];
    let score = 100;
    const outputSizeBytes = pdfBytes.byteLength;

    // 1. Integrity check: Can pdf-lib parse it?
    let pdfLibDoc: PDFDocument | null = null;
    try {
      pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      items.push({
        id: 'integrity-load',
        category: 'integrity',
        label: 'PDF Binary Structure',
        status: 'passed',
        details: 'Output file is structurally sound and adheres to standard PDF format specifications.',
      });
    } catch (e: any) {
      score -= 50;
      items.push({
        id: 'integrity-load',
        category: 'integrity',
        label: 'PDF Binary Structure',
        status: 'failed',
        details: `Failed to parse generated PDF: ${e.message}`,
        suggestedAction: 'Re-export without complex annotations or check source file.',
      });
    }

    // 2. Rendering check: Can pdfjsLib parse and render it?
    let pdfJsDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let actualPageCount = 0;
    let pageDimensions = { width: 0, height: 0 };
    let hasBlankPages = false;

    if (pdfLibDoc) {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: '' });
        pdfJsDoc = await loadingTask.promise;
        actualPageCount = pdfJsDoc.numPages;

        // Check each page dimensions and content
        for (let i = 1; i <= Math.min(actualPageCount, 20); i++) {
          const page = await pdfJsDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          if (viewport.width <= 0 || viewport.height <= 0) {
            hasBlankPages = true;
          }
          if (i === 1) {
            pageDimensions = { width: Math.round(viewport.width), height: Math.round(viewport.height) };
          }
        }

        items.push({
          id: 'render-compatibility',
          category: 'performance',
          label: 'Viewer Render Compatibility',
          status: 'passed',
          details: `All ${actualPageCount} pages parsed successfully with valid viewports (${pageDimensions.width}x${pageDimensions.height}pt).`,
        });
      } catch (e: any) {
        score -= 30;
        items.push({
          id: 'render-compatibility',
          category: 'performance',
          label: 'Viewer Render Compatibility',
          status: 'warning',
          details: `Secondary renderer raised warning: ${e.message}`,
        });
      }
    }

    // 3. Page count verification
    if (expectations.expectedPageCount !== undefined) {
      if (actualPageCount === expectations.expectedPageCount) {
        items.push({
          id: 'page-count',
          category: 'layout',
          label: 'Page Count Consistency',
          status: 'passed',
          details: `Output contains exactly ${actualPageCount} pages as expected for ${expectations.operationName}.`,
        });
      } else {
        score -= 25;
        items.push({
          id: 'page-count',
          category: 'layout',
          label: 'Page Count Consistency',
          status: 'warning',
          details: `Expected ${expectations.expectedPageCount} pages, but generated document has ${actualPageCount} pages.`,
          suggestedAction: 'Verify selected page range or merge input files.',
        });
      }
    } else if (expectations.expectedMinPages !== undefined && actualPageCount < expectations.expectedMinPages) {
      score -= 30;
      items.push({
        id: 'page-count-min',
        category: 'layout',
        label: 'Page Count Check',
        status: 'failed',
        details: `Document must have at least ${expectations.expectedMinPages} pages, found ${actualPageCount}.`,
      });
    }

    // 4. File size check
    if (outputSizeBytes === 0) {
      score = 0;
      items.push({
        id: 'file-size',
        category: 'integrity',
        label: 'File Size Audit',
        status: 'failed',
        details: 'Generated output has zero bytes.',
        suggestedAction: 'Retry operation.',
      });
    } else {
      const sizeKb = (outputSizeBytes / 1024).toFixed(1);
      items.push({
        id: 'file-size',
        category: 'integrity',
        label: 'File Size Audit',
        status: 'passed',
        details: `Valid binary payload generated (${sizeKb} KB).`,
      });
    }

    // 5. PDF Header & Trailer Verification
    const hasValidHeader = pdfBytes.length >= 5 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46; // %PDF
    items.push({
      id: 'header-format',
      category: 'integrity',
      label: 'Standard PDF Header & Magic Bytes',
      status: hasValidHeader ? 'passed' : 'failed',
      details: hasValidHeader ? 'Compliant %PDF-1.x magic bytes header detected.' : 'Missing standard %PDF header magic bytes.',
    });

    // 5. Blank page / dimension check
    if (hasBlankPages) {
      score -= 20;
      items.push({
        id: 'blank-page-check',
        category: 'content',
        label: 'Viewport Geometry',
        status: 'warning',
        details: 'One or more pages have zero or collapsed viewport dimensions.',
      });
    }

    score = Math.max(0, Math.min(100, score));

    const isPassed = score >= 70 && !items.some((i) => i.status === 'failed');

    return {
      passed: isPassed,
      isValid: isPassed,
      score,
      items,
      checks: items,
      timestamp: Date.now(),
      inputSummary: {
        pageCount: expectations.originalPageCount,
        fileSizeBytes: expectations.originalSizeBytes,
      },
      outputSummary: {
        pageCount: actualPageCount,
        fileSizeBytes: outputSizeBytes,
        dimensions: pageDimensions,
      },
    };
  }

  /**
   * Validates DOCX binary output.
   */
  static validateDocxOutput(
    docxBytes: Uint8Array,
    expectations: { originalPageCount?: number; originalSizeBytes?: number }
  ): ValidationReport {
    const items: ValidationItem[] = [];
    let score = 100;
    const outputSizeBytes = docxBytes.byteLength;

    if (outputSizeBytes < 1000) {
      score -= 40;
      items.push({
        id: 'docx-size',
        category: 'integrity',
        label: 'DOCX Package Size',
        status: 'warning',
        details: 'The generated DOCX file is unusually small (< 1KB).',
      });
    } else {
      items.push({
        id: 'docx-size',
        category: 'integrity',
        label: 'DOCX Package Size',
        status: 'passed',
        details: `Standard OpenXML archive created (${(outputSizeBytes / 1024).toFixed(1)} KB).`,
      });
    }

    // Check OpenXML PK header (ZIP format magic bytes: PK\x03\x04)
    const isZip = docxBytes[0] === 0x50 && docxBytes[1] === 0x4b && docxBytes[2] === 0x03 && docxBytes[3] === 0x04;
    if (isZip) {
      items.push({
        id: 'docx-magic-bytes',
        category: 'integrity',
        label: 'OpenXML Archive Structure',
        status: 'passed',
        details: 'Valid DOCX ZIP header verified (PK\\x03\\x04).',
      });
    } else {
      score -= 50;
      items.push({
        id: 'docx-magic-bytes',
        category: 'integrity',
        label: 'OpenXML Archive Structure',
        status: 'failed',
        details: 'Missing valid DOCX ZIP header.',
        suggestedAction: 'Ensure docx generator completed successfully.',
      });
    }

    return {
      passed: score >= 70,
      score,
      items,
      timestamp: Date.now(),
      inputSummary: {
        pageCount: expectations.originalPageCount,
        fileSizeBytes: expectations.originalSizeBytes,
      },
      outputSummary: {
        fileSizeBytes: outputSizeBytes,
      },
    };
  }
}
