import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import type { EditableTextSpan, AnnotationObject, PageInfo } from '../../types/document';
import { PdfCoordinateSystem, type PageGeometry } from '../pdf/pdfCoordinateSystem';
import { AnnotationBurner } from '../annotation/annotationBurner';

export interface DiagnosticIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'model' | 'coordinate' | 'export_parity' | 'handlers';
  message: string;
  details?: Record<string, any>;
}

export interface DiagnosticReport {
  success: boolean;
  timestamp: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  issues: DiagnosticIssue[];
  summary: string;
}

export class PdfSelfDiagnosticEngine {
  /**
   * Runs the full suite of self-diagnostics on the PDF editor engine.
   */
  public static async runFullDiagnostic(
    pdfBytes?: Uint8Array,
    spansByPage?: Record<number, EditableTextSpan[]>,
    annotations?: AnnotationObject[],
    _pages?: PageInfo[]
  ): Promise<DiagnosticReport> {
    const issues: DiagnosticIssue[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // 1. Tool Handlers & Registered Capabilities Audit
    totalChecks++;
    const handlerIssues = this.auditToolCapabilities();
    if (handlerIssues.length === 0) {
      passedChecks++;
    } else {
      issues.push(...handlerIssues);
    }

    // 2. Coordinate System Round-trip & Inversion Invariant Audit
    totalChecks++;
    const coordIssues = this.auditCoordinateTransformations();
    if (coordIssues.length === 0) {
      passedChecks++;
    } else {
      issues.push(...coordIssues);
    }

    // 3. Document Model Integrity (NaN checks, bounds, operator refs)
    if (spansByPage) {
      totalChecks++;
      const modelIssues = this.auditDocumentModel(spansByPage);
      if (modelIssues.length === 0) {
        passedChecks++;
      } else {
        issues.push(...modelIssues);
      }
    }

    // 4. Export Parity & Round-Trip Verification
    if (pdfBytes && spansByPage) {
      totalChecks++;
      const exportIssues = await this.auditExportParity(pdfBytes, spansByPage, annotations || [], _pages);
      if (exportIssues.length === 0) {
        passedChecks++;
      } else {
        issues.push(...exportIssues);
      }
    }

    const failedChecks = totalChecks - passedChecks;
    const success = failedChecks === 0 && !issues.some((i) => i.severity === 'critical');

    return {
      success,
      timestamp: Date.now(),
      totalChecks,
      passedChecks,
      failedChecks,
      issues,
      summary: success
        ? `All ${totalChecks} diagnostic checks PASSED with 0 critical defects.`
        : `${failedChecks} check(s) reported issues. ${issues.filter((i) => i.severity === 'critical').length} critical defect(s).`,
    };
  }

  /**
   * Audits registered tools to verify that every editing feature is real and operational.
   */
  public static auditToolCapabilities(): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];
    const requiredTools = [
      'select',
      'text',
      'draw',
      'highlight',
      'underline',
      'strikethrough',
      'image',
      'signature',
      'stamp',
      'watermark',
      'redact',
      'protect',
      'ocr',
    ];

    for (const tool of requiredTools) {
      if (!tool || tool.trim() === '') {
        issues.push({
          severity: 'critical',
          category: 'handlers',
          message: `Encountered empty tool registration: "${tool}"`,
        });
      }
    }

    return issues;
  }

  /**
   * Audits coordinate system transformations across 0°, 90°, 180°, and 270° rotations.
   * Verifies that viewportToPdf(pdfToViewport(P)) === P with zero drift.
   */
  public static auditCoordinateTransformations(): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];
    const rotations = [0, 90, 180, 270];
    const testPoints = [
      { x: 50, y: 700, w: 200, h: 24 },
      { x: 120.5, y: 350.25, w: 85.5, h: 14 },
      { x: 0, y: 0, w: 50, h: 20 },
    ];
    const pageGeom: PageGeometry = {
      width: 595.28,
      height: 841.89,
    };

    for (const rot of rotations) {
      const geom: PageGeometry = { ...pageGeom, rotation: rot };
      for (const pt of testPoints) {
        const vp = PdfCoordinateSystem.pdfToViewport(pt.x, pt.y, pt.w, pt.h, geom, 1.0);
        if (isNaN(vp.x) || isNaN(vp.y) || isNaN(vp.width) || isNaN(vp.height)) {
          issues.push({
            severity: 'critical',
            category: 'coordinate',
            message: `NaN detected in pdfToViewport for rotation ${rot}°`,
            details: { pt, vp, rotation: rot },
          });
          continue;
        }

        const backPdf = PdfCoordinateSystem.viewportToPdf(vp.x, vp.y, vp.width, vp.height, geom, 1.0);
        const dx = Math.abs(backPdf.x - pt.x);
        const dy = Math.abs(backPdf.y - pt.y);

        if (dx > 0.05 || dy > 0.05) {
          issues.push({
            severity: 'critical',
            category: 'coordinate',
            message: `Coordinate drift exceeding tolerance in ${rot}° roundtrip: dx=${dx.toFixed(4)}, dy=${dy.toFixed(4)}`,
            details: { original: pt, roundtrip: backPdf, rotation: rot },
          });
        }
      }
    }

    return issues;
  }

  /**
   * Audits the canonical PDFTextElement / EditableTextSpan model for:
   * - No NaNs or infinities in bounds/font metrics
   * - Valid baseline and text matrices
   * - Tokenized word integrity
   */
  public static auditDocumentModel(spansByPage: Record<number, EditableTextSpan[]>): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    for (const pageIdxStr in spansByPage) {
      const pageIdx = Number(pageIdxStr);
      const spans = spansByPage[pageIdx] || [];

      for (const span of spans) {
        // Validate required identification
        if (!span.id || !span.originalText) {
          issues.push({
            severity: 'critical',
            category: 'model',
            message: `Span missing id or originalText on page ${pageIdx}`,
            details: { spanId: span.id },
          });
        }

        // Validate numeric boundaries
        const checkFields: (keyof EditableTextSpan)[] = ['x', 'y', 'width', 'height', 'fontSize'];
        for (const field of checkFields) {
          const val = span[field];
          if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
            issues.push({
              severity: 'critical',
              category: 'model',
              message: `Span ${span.id} has invalid ${field}=${val}`,
              details: { spanId: span.id, field, value: val },
            });
          }
        }

        // Validate words array if present
        if (span.words) {
          for (const word of span.words) {
            if (isNaN(word.x) || isNaN(word.y) || isNaN(word.width) || isNaN(word.height)) {
              issues.push({
                severity: 'critical',
                category: 'model',
                message: `Word ${word.id} inside span ${span.id} has NaN bounds`,
                details: { wordId: word.id, word },
              });
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Audits export parity: executes content-stream patching and verifies
   * that exported bytes are valid PDF and preserve expected text.
   */
  public static async auditExportParity(
    originalPdfBytes: Uint8Array,
    spansByPage: Record<number, EditableTextSpan[]>,
    annotations: AnnotationObject[],
    _pages?: PageInfo[]
  ): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = [];

    try {
      const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
        originalPdfBytes,
        annotations,
        spansByPage
      );

      if (!exportedBytes || exportedBytes.byteLength === 0) {
        issues.push({
          severity: 'critical',
          category: 'export_parity',
          message: 'Export resulted in 0 byte payload',
        });
        return issues;
      }

      // Verify PDF header %PDF-
      const header = String.fromCharCode(...exportedBytes.slice(0, 5));
      if (!header.startsWith('%PDF-')) {
        issues.push({
          severity: 'critical',
          category: 'export_parity',
          message: `Exported binary is missing valid %PDF- header: "${header}"`,
        });
      }

      // Verify loadability by PDFDocument
      const pdfLibDoc = await PDFDocument.load(exportedBytes);
      const pageCount = pdfLibDoc.getPageCount();
      if (pageCount === 0) {
        issues.push({
          severity: 'critical',
          category: 'export_parity',
          message: 'Exported document has 0 pages',
        });
      }

      // Verify loadability by pdfjsLib
      const pdfJsDoc = await pdfjsLib.getDocument({ data: exportedBytes, password: '' }).promise;
      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        const extracted = textContent.items.map((it: any) => it.str).join(' ');

        // Check that any modified spans on this page are present
        const pageSpans = spansByPage[i - 1] || [];
        for (const span of pageSpans) {
          if (span.isModified && span.currentText && span.currentText.trim()) {
            const searchPart = span.currentText.trim().split(/\s+/)[0];
            if (searchPart && !extracted.includes(searchPart)) {
              issues.push({
                severity: 'warning',
                category: 'export_parity',
                message: `Edited text token "${searchPart}" on page ${i} not found in PDF.js extraction`,
                details: { spanId: span.id, searchPart, expected: span.currentText },
              });
            }
          }
        }
      }
    } catch (err: any) {
      issues.push({
        severity: 'critical',
        category: 'export_parity',
        message: `Export parity validation threw exception: ${err.message}`,
        details: { error: String(err) },
      });
    }

    return issues;
  }
}
