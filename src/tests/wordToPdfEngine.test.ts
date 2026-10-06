import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType } from 'docx';
import { WordToPdfEngine } from '../engines/conversion/wordToPdfEngine';
import { PdfToWordEngine } from '../engines/conversion/pdfToWordEngine';

describe('WordToPdfEngine — Deep OpenXML Parsing & High-Fidelity Typesetting', () => {
  it('converts a styled DOCX with headings, alignments, colors, and tables to PDF', async () => {
    // 1. Build a structured DOCX using the docx library
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'EXECUTIVE SUMMARY',
              heading: 'Heading1',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'This is a high-fidelity document converted directly from OpenXML.',
                  size: 24, // 12pt
                  color: '1E40AF', // Blue
                }),
                new TextRun({
                  text: ' It contains bold and italic formatting.',
                  bold: true,
                  italics: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Underlined and strikethrough text items:',
                  underline: {},
                  strike: true,
                  color: 'DC2626',
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: 'Metric Header' })],
                      shading: { fill: 'F1F5F9' },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: 'Value Header' })],
                      shading: { fill: 'F1F5F9' },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: 'Conversion Accuracy' })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: '99.8%' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    const docxBuffer = await Packer.toBuffer(doc);

    // 2. Convert DOCX to PDF
    const progressMessages: string[] = [];
    const pdfBytes = await WordToPdfEngine.convertDocxToPdf(docxBuffer, (_pct, msg) => {
      progressMessages.push(msg);
    });

    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.byteLength).toBeGreaterThan(500);

    // Verify PDF header: %PDF
    const header = String.fromCharCode(...pdfBytes.slice(0, 4));
    expect(header).toBe('%PDF');

    // 3. Load PDF with pdf-lib to verify structure
    const parsedPdf = await PDFDocument.load(pdfBytes);
    expect(parsedPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    const firstPage = parsedPdf.getPage(0);
    expect(firstPage.getWidth()).toBeGreaterThan(500);
    expect(firstPage.getHeight()).toBeGreaterThan(700);

    // Verify progress tracking
    expect(progressMessages.length).toBeGreaterThan(0);
  });

  it('performs full round-trip conversion: PDF -> DOCX -> PDF preserving core structure', async () => {
    // 1. Create source PDF
    const srcDoc = await PDFDocument.create();
    const font = await srcDoc.embedFont(StandardFonts.HelveticaBold);
    const page = srcDoc.addPage([595, 842]);
    page.drawText('DocuLoom Round-Trip Verification Test', {
      x: 50,
      y: 780,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText('Validating OpenXML extraction and typesetting fidelity.', {
      x: 50,
      y: 740,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    const srcPdfBytes = await srcDoc.save();

    // 2. Convert PDF -> DOCX
    const docxBytes = await PdfToWordEngine.convertPdfToDocx(srcPdfBytes);
    expect(docxBytes.byteLength).toBeGreaterThan(500);

    // 3. Convert DOCX -> PDF
    const roundTripPdfBytes = await WordToPdfEngine.convertDocxToPdf(docxBytes);
    expect(roundTripPdfBytes.byteLength).toBeGreaterThan(500);

    const parsedRoundTrip = await PDFDocument.load(roundTripPdfBytes);
    expect(parsedRoundTrip.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
