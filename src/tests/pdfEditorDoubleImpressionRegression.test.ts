import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { TextObjectModel } from '../engines/pdf/textObjectModel';
import { AnnotationBurner } from '../engines/annotation/annotationBurner';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import type { EditableTextSpan } from '../types/document';

async function createLoremIpsumPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([600, 800]);
  page.drawText('Lorem ipsum dolor sit amet', {
    x: 50,
    y: 720,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Consectetur adipiscing elit sed do eiusmod', {
    x: 50,
    y: 690,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  return await pdfDoc.save();
}

describe('PDF Editor Double-Impression & Ghosting Elimination Regression Tests', () => {
  it('1. Exact User Reproduction: edits "sit" -> "vivek" without double-impression or ghosting', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    expect(textSpans.length).toBeGreaterThan(0);
    const targetSpan = textSpans.find((s) => s.originalText.includes('sit'));
    expect(targetSpan).toBeDefined();
    expect(targetSpan!.words).toBeDefined();

    // Find the word "sit"
    const sitWord = targetSpan!.words!.find((w) => w.text === 'sit');
    expect(sitWord).toBeDefined();

    // Edit "sit" to "vivek"
    const modifiedSpan = TextObjectModel.updateWordInSpan(targetSpan!, sitWord!.id, 'vivek');

    expect(modifiedSpan.isModified).toBe(true);
    expect(modifiedSpan.currentText).toBe('Lorem ipsum dolor vivek amet');

    // Burn edits to create exported PDF
    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      { 0: [modifiedSpan] }
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(0);

    // Re-load exported document to verify authoritative content
    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);

    const fullExtractedText = reloadedSpans.map((s) => s.currentText).join(' ');
    expect(fullExtractedText).toContain('vivek');
    expect(fullExtractedText).toContain('Lorem ipsum dolor vivek amet');

    // Ensure the old word "sit" was completely eradicated (no ghosting or residual duplicate text)
    expect(fullExtractedText).not.toContain('sit');
  });

  it('2. Shorter Word Replacement: edits "sit" -> "X" without exposing underlying canvas text', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    const targetSpan = textSpans.find((s) => s.originalText.includes('sit'))!;
    const sitWord = targetSpan.words!.find((w) => w.text === 'sit')!;

    const modifiedSpan = TextObjectModel.updateWordInSpan(targetSpan, sitWord.id, 'X');
    expect(modifiedSpan.currentText).toBe('Lorem ipsum dolor X amet');

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      { 0: [modifiedSpan] }
    );

    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
    const fullText = reloadedSpans.map((s) => s.currentText).join(' ');

    expect(fullText).toContain('Lorem ipsum dolor X amet');
    expect(fullText).not.toContain('sit');
  });

  it('3. Multi-word Expansion: edits "sit" -> "Vivek Dhoundiyal" without truncation or collision', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    const targetSpan = textSpans.find((s) => s.originalText.includes('sit'))!;
    const sitWord = targetSpan.words!.find((w) => w.text === 'sit')!;

    const modifiedSpan = TextObjectModel.updateWordInSpan(targetSpan, sitWord.id, 'Vivek Dhoundiyal');
    expect(modifiedSpan.currentText).toBe('Lorem ipsum dolor Vivek Dhoundiyal amet');

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      { 0: [modifiedSpan] }
    );

    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
    const fullText = reloadedSpans.map((s) => s.currentText).join(' ');

    expect(fullText).toContain('Vivek Dhoundiyal');
    expect(fullText).not.toContain('sit');
  });

  it('4. Sequential Edits on Same Span: edits twice in a row cleanly', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    const targetSpan = textSpans.find((s) => s.originalText.includes('sit'))!;
    const sitWord = targetSpan.words!.find((w) => w.text === 'sit')!;

    // Edit 1: "sit" -> "vivek"
    const edit1 = TextObjectModel.updateWordInSpan(targetSpan, sitWord.id, 'vivek');
    expect(edit1.currentText).toBe('Lorem ipsum dolor vivek amet');

    // Edit 2: "vivek" -> "PRODUCTION READY"
    const edit2 = TextObjectModel.syncSpanText(edit1, 'Lorem ipsum dolor PRODUCTION READY amet', 800);
    expect(edit2.isModified).toBe(true);
    expect(edit2.currentText).toBe('Lorem ipsum dolor PRODUCTION READY amet');

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      { 0: [edit2] }
    );

    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
    const fullText = reloadedSpans.map((s) => s.currentText).join(' ');

    expect(fullText).toContain('PRODUCTION READY');
    expect(fullText).not.toContain('sit');
    expect(fullText).not.toContain('vivek');
  });

  it('5. Text Span Deletion: masks and completely removes deleted text on export', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const pdfJsDoc = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans } = await PdfEngine.extractPageTextSpans(pdfJsDoc, 1);

    const targetSpan = textSpans.find((s) => s.originalText.includes('sit'))!;
    const deletedSpan: EditableTextSpan = {
      ...targetSpan,
      isDeleted: true,
      currentText: '',
      isModified: true,
    };

    const exportedBytes = await AnnotationBurner.burnAllEditsAndAnnotations(
      baseBytes,
      [],
      { 0: [deletedSpan] }
    );

    const reloadedDoc = await PdfEngine.loadPdfJsDoc(exportedBytes);
    const { textSpans: reloadedSpans } = await PdfEngine.extractPageTextSpans(reloadedDoc, 1);
    const fullText = reloadedSpans.map((s) => s.currentText).join(' ');

    // "sit" line should be completely gone
    expect(fullText).not.toContain('sit');
    expect(fullText).not.toContain('Lorem ipsum');
    // Surrounding lines remain intact
    expect(fullText).toContain('Consectetur adipiscing');
  });

  it('6. Incremental In-Memory Re-render Lifecycle: edits word, re-renders in-memory PDF, edits again cleanly', async () => {
    const baseBytes = await createLoremIpsumPdf();
    const doc0 = await PdfEngine.loadPdfJsDoc(baseBytes);
    const { textSpans: spans0 } = await PdfEngine.extractPageTextSpans(doc0, 1);

    const span0 = spans0.find((s) => s.originalText.includes('sit'))!;
    const wordSit = span0.words!.find((w) => w.text === 'sit')!;

    // Step 1: User edits "sit" -> "vivek" and commits
    const edit1 = TextObjectModel.updateWordInSpan(span0, wordSit.id, 'vivek');
    const bytes1 = await AnnotationBurner.burnAllEditsAndAnnotations(baseBytes, [], { 0: [edit1] });

    // In-memory document updates, PDF.js loads bytes1 and re-extracts spans
    const doc1 = await PdfEngine.loadPdfJsDoc(bytes1);
    const { textSpans: spans1 } = await PdfEngine.extractPageTextSpans(doc1, 1);

    const span1 = spans1.find((s) => s.currentText.includes('vivek'))!;
    expect(span1).toBeDefined();
    const wordVivek = span1.words!.find((w) => w.text === 'vivek')!;
    expect(wordVivek).toBeDefined();

    // Step 2: User edits "dolor" -> "magna" on the same line and commits
    const wordDolor = span1.words!.find((w) => w.text === 'dolor')!;
    expect(wordDolor).toBeDefined();

    const edit2 = TextObjectModel.updateWordInSpan(span1, wordDolor.id, 'magna');
    const bytes2 = await AnnotationBurner.burnAllEditsAndAnnotations(bytes1, [], { 0: [edit2] });

    const doc2 = await PdfEngine.loadPdfJsDoc(bytes2);
    const { textSpans: spans2 } = await PdfEngine.extractPageTextSpans(doc2, 1);
    const fullText2 = spans2.map((s) => s.currentText).join(' ');

    expect(fullText2).toContain('Lorem ipsum magna vivek amet');
    expect(fullText2).not.toContain('sit');
    expect(fullText2).not.toContain('dolor');
  });
});
