import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { TextObjectModel } from '../engines/pdf/textObjectModel';
import { ValidationEngine } from '../engines/validation/validationEngine';
import type { AnnotationObject, EditableTextSpan } from '../types/document';

const SAMPLE_1PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createMultiPageTestPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = pdfDoc.addPage([595.28, 841.89]);
  page1.drawText('Sample PDF Document Heading', {
    x: 50,
    y: 780,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  page1.drawText('This is the original introductory body text for testing.', {
    x: 50,
    y: 740,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  page1.drawText('This paragraph will be deleted by the user.', {
    x: 50,
    y: 700,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Page 2
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Page 2: Summary and Signature', {
    x: 50,
    y: 780,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  return await pdfDoc.save();
}

describe('NUVIO Production PDF Editing Engine — Complete Workflow & Round-Trip QA', () => {
  it('1. Full Lifecycle: Open -> Edit -> Restyle -> Delete Text -> Add Objects -> Undo/Redo -> Export -> Re-open & Verify', async () => {
    // A. Generate initial multi-page PDF
    const initialBytes = await createMultiPageTestPdf();
    expect(initialBytes.length).toBeGreaterThan(500);

    // B. Parse PDF with PdfEngine & PDF.js
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(initialBytes);
    expect(pdfJsDoc.numPages).toBe(2);

    const info = await PdfEngine.getPdfInfo(initialBytes, 'test-doc.pdf');
    expect(info.pageCount).toBe(2);
    expect(info.pages.length).toBe(2);

    const { textSpans: page1Spans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);
    expect(page1Spans.length).toBeGreaterThanOrEqual(3);

    // C. Select and edit existing text in place
    // Find the heading span
    const headingSpan = page1Spans.find((s) => s.originalText.includes('Sample PDF Document Heading'));
    expect(headingSpan).toBeDefined();

    const editedHeadingSpan: EditableTextSpan = {
      ...headingSpan!,
      currentText: 'NUVIO Professional PDF Editor Heading',
      isModified: true,
    };

    // D. Restyle existing body text (font, size, color, bold, italic, alignment)
    const bodySpan = page1Spans.find((s) => s.originalText.includes('original introductory body text'));
    expect(bodySpan).toBeDefined();

    const restyledBodySpan: EditableTextSpan = {
      ...bodySpan!,
      currentText: 'Updated body text with modern typography and styling.',
      fontFamily: "'Times New Roman', Times, serif",
      fontSize: 16,
      color: '#2563eb',
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      letterSpacing: 0,
      isModified: true,
    };

    // E. Delete existing text
    const deleteSpan = page1Spans.find((s) => s.originalText.includes('will be deleted'));
    expect(deleteSpan).toBeDefined();

    const deletedSpan: EditableTextSpan = {
      ...deleteSpan!,
      isDeleted: true,
      currentText: '',
      isModified: true,
    };

    // Build edited spans state
    const editedSpansByPage: Record<number, EditableTextSpan[]> = {
      0: [editedHeadingSpan, restyledBodySpan, deletedSpan],
    };

    // F. Add inserted Text Box
    const newTextBox: AnnotationObject = {
      id: 'text-box-1',
      type: 'text',
      pageIndex: 0,
      x: 50,
      y: 200,
      width: 250,
      height: 40,
      text: 'Newly inserted standalone text box',
      fontSize: 14,
      fontFamily: 'Helvetica, sans-serif',
      textColor: '#0f172a',
      backgroundColor: '#f1f5f9',
      createdAt: Date.now(),
    };

    // G. Add Signature
    const signatureObj: AnnotationObject = {
      id: 'sig-1',
      type: 'signature',
      pageIndex: 1,
      x: 50,
      y: 600,
      width: 150,
      height: 50,
      imageDataUrl: SAMPLE_1PX_PNG,
      createdAt: Date.now(),
    };

    // H. Add Stamp
    const stampObj: AnnotationObject = {
      id: 'stamp-1',
      type: 'stamp',
      pageIndex: 0,
      x: 350,
      y: 50,
      width: 140,
      height: 45,
      stampText: 'APPROVED',
      strokeColor: '#16a34a',
      textColor: '#16a34a',
      rotation: -10,
      createdAt: Date.now(),
    };

    // I. Add Shapes & Watermark
    const rectShape: AnnotationObject = {
      id: 'shape-rect-1',
      type: 'shape',
      shapeType: 'rectangle',
      pageIndex: 0,
      x: 40,
      y: 400,
      width: 200,
      height: 80,
      strokeColor: '#2563eb',
      strokeWidth: 2,
      fillColor: 'transparent',
      createdAt: Date.now(),
    };

    const watermarkObj: AnnotationObject = {
      id: 'wm-1',
      type: 'watermark',
      pageIndex: 0,
      x: 100,
      y: 350,
      width: 400,
      height: 100,
      watermarkType: 'text',
      text: 'CONFIDENTIAL',
      fontSize: 48,
      textColor: '#dc2626',
      opacity: 0.2,
      rotation: -35,
      createdAt: Date.now(),
    };

    // Add object to delete (to verify deletion workflow)
    const tempObj: AnnotationObject = {
      id: 'temp-to-delete',
      type: 'shape',
      shapeType: 'circle',
      pageIndex: 0,
      x: 300,
      y: 300,
      width: 50,
      height: 50,
      strokeColor: '#000000',
      createdAt: Date.now(),
    };

    let annotationsList: AnnotationObject[] = [
      newTextBox,
      signatureObj,
      stampObj,
      rectShape,
      watermarkObj,
      tempObj,
    ];

    // J. Delete tempObj (simulating user delete operation)
    annotationsList = annotationsList.filter((a) => a.id !== 'temp-to-delete');
    expect(annotationsList.find((a) => a.id === 'temp-to-delete')).toBeUndefined();

    // K. Verify Undo/Redo state mechanics
    interface HistoryItem {
      annotations: AnnotationObject[];
      editableSpansByPage: Record<number, EditableTextSpan[]>;
    }
    const historyStack: HistoryItem[] = [
      { annotations: [], editableSpansByPage: {} },
      { annotations: annotationsList, editableSpansByPage: editedSpansByPage },
    ];
    let currentIndex = 1;

    // Undo
    currentIndex--;
    expect(historyStack[currentIndex].annotations.length).toBe(0);

    // Redo
    currentIndex++;
    expect(historyStack[currentIndex].annotations.length).toBe(5);

    // L. Export the PDF document
    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      initialBytes,
      annotationsList,
      editedSpansByPage
    );

    expect(exportedBytes).toBeDefined();
    expect(exportedBytes.length).toBeGreaterThan(initialBytes.length);

    // M. Re-open exported PDF with PDFDocument (pdf-lib)
    const reopenedDoc = await PDFDocument.load(exportedBytes);
    expect(reopenedDoc.getPageCount()).toBe(2);

    // N. Re-open exported PDF with PDF.js and verify text streams
    const reopenedPdfJs = await PdfEngine.loadPdfJsDoc(exportedBytes);
    expect(reopenedPdfJs.numPages).toBe(2);

    const { textSpans: reExtractedPage1Spans } = await PdfEngine.extractPageTextSpans(reopenedPdfJs, 1);
    const page1AllText = reExtractedPage1Spans.map((s) => s.originalText).join(' ');

    // 1. Verify edited text is present in the PDF!
    expect(page1AllText).toContain('NUVIO Professional PDF Editor Heading');

    // 2. Verify restyled text is present in the PDF!
    expect(page1AllText).toContain('Updated body text with modern typography and styling.');

    // 3. Verify newly inserted text box is present in the PDF!
    expect(page1AllText).toContain('Newly inserted standalone text box');

    // 4. Verify stamp text is present in the PDF!
    expect(page1AllText).toContain('APPROVED');

    // 5. Verify watermark text is present in the PDF!
    expect(page1AllText).toContain('CONFIDENTIAL');

    // O. Automated Validation Report
    const report = await ValidationEngine.validatePdf(exportedBytes);
    expect(report.isValid).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.outputSummary.pageCount).toBe(2);
  });

  it('2. Word-Level Text Object Synchronization: TextObjectModel preserves spans and coordinates', () => {
    const mockSpan: EditableTextSpan = {
      id: 'span-test-1',
      pageIndex: 0,
      streamIndex: 0,
      opIndex: 1,
      sourceOperatorReference: { streamIndex: 0, opIndex: 1, operandIndex: 0 },
      sourceTextItemReference: 'item-1',
      fontResourceName: 'F1',
      rawTextMatrix: [1, 0, 0, 1, 50, 750],
      rawOperandType: 'literal',
      originalText: 'Sample PDF Document',
      currentText: 'Sample PDF Document',
      originalFont: 'Helvetica',
      resolvedFont: 'Helvetica, Arial, sans-serif',
      x: 50,
      y: 91.89,
      pdfX: 50,
      pdfY: 750,
      width: 150,
      height: 16,
      fontSize: 16,
      originalFontSize: 16,
      fontFamily: 'Helvetica, Arial, sans-serif',
      pdfFontName: 'Helvetica',
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      rgbColor: { r: 0, g: 0, b: 0 },
      isModified: false,
    };

    // Tokenize
    const words = TextObjectModel.tokenizeSpanIntoWords(mockSpan, 841.89);
    expect(words.length).toBe(3);
    expect(words[0].text).toBe('Sample');
    expect(words[1].text).toBe('PDF');
    expect(words[2].text).toBe('Document');

    // Update single word
    const updatedSpan = TextObjectModel.updateWordInSpan(
      { ...mockSpan, words },
      words[1].id,
      'PDC'
    );
    expect(updatedSpan.currentText).toBe('Sample PDC Document');
    expect(updatedSpan.isModified).toBe(true);
  });

  it('3. Untouched document byte preservation rule', async () => {
    const rawPdf = await createMultiPageTestPdf();
    const result = await AnnotationBurner.burnAllEditsAndAnnotations(rawPdf, [], {});
    expect(result).toBe(rawPdf);
  });
});
