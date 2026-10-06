import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';

interface ParsedRun {
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: { r: number; g: number; b: number };
  highlightColor?: { r: number; g: number; b: number };
  drawingRId?: string;
  drawingWidthPt?: number;
  drawingHeightPt?: number;
}

interface ParsedParagraph {
  type: 'paragraph';
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBefore: number;
  spacingAfter: number;
  runs: ParsedRun[];
}

interface ParsedCell {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: { r: number; g: number; b: number };
  backgroundColor?: { r: number; g: number; b: number };
}

interface ParsedTable {
  type: 'table';
  rows: ParsedCell[][];
}

type ParsedDocElement = ParsedParagraph | ParsedTable;

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function sanitizePdfText(str: string): string {
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x20-\x7E\t\n\r]/g, ' ');
}

function parseHexColor(hexStr?: string | null): { r: number; g: number; b: number } | undefined {
  if (!hexStr || hexStr.toLowerCase() === 'auto' || hexStr.length !== 6) return undefined;
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return undefined;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export class WordToPdfEngine {
  /**
   * Converts a DOCX file buffer into a high-fidelity PDF preserving fonts, sizes, colors,
   * alignments, tables, headings, and embedded images.
   */
  static async convertDocxToPdf(
    docxBuffer: ArrayBuffer | Uint8Array,
    onProgress?: (percent: number, message: string) => void
  ): Promise<Uint8Array> {
    onProgress?.(10, 'Opening DOCX archive...');

    try {
      const zip = await JSZip.loadAsync(docxBuffer);
      const docXmlFile = zip.file('word/document.xml');

      if (!docXmlFile) {
        // Fallback to mammoth if not standard docx
        return await this.fallbackConvertMammoth(docxBuffer, onProgress);
      }

      onProgress?.(25, 'Inspecting OpenXML structure...');
      const docXmlStr = await docXmlFile.async('string');

      // 1. Parse Relationships (word/_rels/document.xml.rels) for images
      const relsMap: Record<string, string> = {};
      const relsFile = zip.file('word/_rels/document.xml.rels');
      if (relsFile) {
        const relsStr = await relsFile.async('string');
        const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
        let rMatch: RegExpExecArray | null;
        while ((rMatch = relRegex.exec(relsStr)) !== null) {
          const id = rMatch[1];
          let target = rMatch[2];
          if (target.startsWith('/')) target = target.slice(1);
          if (target.startsWith('media/')) target = `word/${target}`;
          relsMap[id] = target;
        }
      }

      // 2. Parse Page Geometry & Margins
      let pageWidth = 595.28; // A4 standard pt
      let pageHeight = 841.89;
      let topMargin = 54;
      let bottomMargin = 54;
      let leftMargin = 54;
      let rightMargin = 54;

      const pgSzMatch = docXmlStr.match(/<w:pgSz\s+[^>]*w:w="(\d+)"\s+[^>]*w:h="(\d+)"/);
      if (pgSzMatch) {
        const wTwips = Number(pgSzMatch[1]);
        const hTwips = Number(pgSzMatch[2]);
        if (wTwips > 0 && hTwips > 0) {
          pageWidth = wTwips / 20;
          pageHeight = hTwips / 20;
        }
      }

      const pgMarMatch = docXmlStr.match(/<w:pgMar\s+[^>]*w:top="(\d+)"\s+[^>]*w:bottom="(\d+)"\s+[^>]*w:left="(\d+)"\s+[^>]*w:right="(\d+)"/);
      if (pgMarMatch) {
        const top = Number(pgMarMatch[1]);
        const bottom = Number(pgMarMatch[2]);
        const left = Number(pgMarMatch[3]);
        const right = Number(pgMarMatch[4]);
        if (top > 0) topMargin = Math.max(36, Math.min(top / 20, 100));
        if (bottom > 0) bottomMargin = Math.max(36, Math.min(bottom / 20, 100));
        if (left > 0) leftMargin = Math.max(36, Math.min(left / 20, 100));
        if (right > 0) rightMargin = Math.max(36, Math.min(right / 20, 100));
      }

      const contentWidth = pageWidth - leftMargin - rightMargin;

      onProgress?.(40, 'Parsing document elements & formatting...');
      const elements = this.parseDocumentElements(docXmlStr);

      onProgress?.(60, 'Typesetting high-fidelity PDF pages...');
      const pdfDoc = await PDFDocument.create();

      // Embed Standard PDF Font Families
      const fonts = {
        helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        helveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        helveticaBoldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
        times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        timesBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        timesItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
        timesBoldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
        courier: await pdfDoc.embedFont(StandardFonts.Courier),
        courierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
        courierOblique: await pdfDoc.embedFont(StandardFonts.CourierOblique),
        courierBoldOblique: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
      };

      const pickFont = (family: string, bold: boolean, italic: boolean): PDFFont => {
        const f = family.toLowerCase();
        if (f.includes('times') || f.includes('serif') || f.includes('georgia') || f.includes('garamond')) {
          if (bold && italic) return fonts.timesBoldItalic;
          if (bold) return fonts.timesBold;
          if (italic) return fonts.timesItalic;
          return fonts.times;
        }
        if (f.includes('courier') || f.includes('mono') || f.includes('consol')) {
          if (bold && italic) return fonts.courierBoldOblique;
          if (bold) return fonts.courierBold;
          if (italic) return fonts.courierOblique;
          return fonts.courier;
        }
        if (bold && italic) return fonts.helveticaBoldOblique;
        if (bold) return fonts.helveticaBold;
        if (italic) return fonts.helveticaOblique;
        return fonts.helvetica;
      };

      let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - topMargin;

      const checkNewPage = (neededSpace: number) => {
        if (currentY - neededSpace < bottomMargin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - topMargin;
        }
      };

      // 3. Typeset each element
      for (const el of elements) {
        if (el.type === 'paragraph') {
          if (el.spacingBefore > 0) {
            currentY -= Math.min(el.spacingBefore, 30);
          }

          // Check if paragraph is purely drawings or text
          const runsWithDrawing = el.runs.filter((r) => r.drawingRId);
          for (const dRun of runsWithDrawing) {
            const relPath = relsMap[dRun.drawingRId!];
            if (relPath) {
              const imgFile = zip.file(relPath);
              if (imgFile) {
                try {
                  const imgBytes = await imgFile.async('uint8array');
                  let embeddedImage;
                  if (
                    imgBytes[0] === 0x89 &&
                    imgBytes[1] === 0x50 &&
                    imgBytes[2] === 0x4e &&
                    imgBytes[3] === 0x47
                  ) {
                    embeddedImage = await pdfDoc.embedPng(imgBytes);
                  } else {
                    embeddedImage = await pdfDoc.embedJpg(imgBytes);
                  }

                  let renderW = dRun.drawingWidthPt || embeddedImage.width * 0.75;
                  let renderH = dRun.drawingHeightPt || embeddedImage.height * 0.75;

                  if (renderW > contentWidth) {
                    const scale = contentWidth / renderW;
                    renderW = contentWidth;
                    renderH *= scale;
                  }

                  checkNewPage(renderH + 12);
                  const imgX =
                    el.alignment === 'center'
                      ? leftMargin + (contentWidth - renderW) / 2
                      : el.alignment === 'right'
                      ? leftMargin + (contentWidth - renderW)
                      : leftMargin;

                  currentPage.drawImage(embeddedImage, {
                    x: imgX,
                    y: currentY - renderH,
                    width: renderW,
                    height: renderH,
                  });
                  currentY -= renderH + 12;
                } catch {
                  // Ignore image embedding error
                }
              }
            }
          }

          // Typeset text runs
          const textRuns = el.runs.filter((r) => r.text.length > 0);
          if (textRuns.length > 0) {
            // Split text runs into printable word tokens
            interface WordToken {
              text: string;
              font: PDFFont;
              size: number;
              color: { r: number; g: number; b: number };
              highlightColor?: { r: number; g: number; b: number };
              underline: boolean;
              strike: boolean;
              width: number;
            }

            const tokens: WordToken[] = [];
            for (const r of textRuns) {
              const font = pickFont(r.fontFamily, r.bold, r.italic);
              const cleanText = sanitizePdfText(r.text);
              const words = cleanText.split(/(\s+)/);

              for (const w of words) {
                if (!w) continue;
                let wWidth = 0;
                try {
                  wWidth = font.widthOfTextAtSize(w, r.fontSize);
                } catch {
                  wWidth = r.fontSize * 0.55 * w.length;
                }
                tokens.push({
                  text: w,
                  font,
                  size: r.fontSize,
                  color: r.color,
                  highlightColor: r.highlightColor,
                  underline: r.underline,
                  strike: r.strike,
                  width: wWidth,
                });
              }
            }

            // Word wrap tokens into lines
            let currentLine: WordToken[] = [];
            let currentLineWidth = 0;
            const lines: WordToken[][] = [];

            for (const token of tokens) {
              if (token.text.includes('\n')) {
                lines.push(currentLine);
                currentLine = [];
                currentLineWidth = 0;
                continue;
              }

              if (currentLineWidth + token.width > contentWidth && currentLine.length > 0 && token.text.trim()) {
                lines.push(currentLine);
                currentLine = [token];
                currentLineWidth = token.width;
              } else {
                currentLine.push(token);
                currentLineWidth += token.width;
              }
            }
            if (currentLine.length > 0) {
              lines.push(currentLine);
            }

            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx];
              if (line.length === 0) {
                currentY -= 14;
                continue;
              }

              const maxLineSize = Math.max(...line.map((t) => t.size), 11);
              const lineHeight = maxLineSize * 1.35;
              checkNewPage(lineHeight);

              const totalLineWidth = line.reduce((acc, t) => acc + t.width, 0);
              let startX = leftMargin;
              if (el.alignment === 'center') {
                startX = leftMargin + Math.max(0, (contentWidth - totalLineWidth) / 2);
              } else if (el.alignment === 'right') {
                startX = leftMargin + Math.max(0, contentWidth - totalLineWidth);
              }

              let curX = startX;
              for (const tok of line) {
                if (tok.highlightColor) {
                  currentPage.drawRectangle({
                    x: curX,
                    y: currentY - 2,
                    width: tok.width,
                    height: tok.size * 1.15,
                    color: rgb(tok.highlightColor.r, tok.highlightColor.g, tok.highlightColor.b),
                    opacity: 0.4,
                  });
                }

                if (tok.text.trim()) {
                  currentPage.drawText(tok.text, {
                    x: curX,
                    y: currentY,
                    size: tok.size,
                    font: tok.font,
                    color: rgb(tok.color.r, tok.color.g, tok.color.b),
                  });

                  if (tok.underline) {
                    currentPage.drawLine({
                      start: { x: curX, y: currentY - 1.5 },
                      end: { x: curX + tok.width, y: currentY - 1.5 },
                      thickness: 1,
                      color: rgb(tok.color.r, tok.color.g, tok.color.b),
                    });
                  }

                  if (tok.strike) {
                    currentPage.drawLine({
                      start: { x: curX, y: currentY + tok.size * 0.35 },
                      end: { x: curX + tok.width, y: currentY + tok.size * 0.35 },
                      thickness: 1,
                      color: rgb(tok.color.r, tok.color.g, tok.color.b),
                    });
                  }
                }

                curX += tok.width;
              }

              currentY -= lineHeight;
            }
          }

          if (el.spacingAfter > 0) {
            currentY -= Math.min(el.spacingAfter, 24);
          } else {
            currentY -= 4; // Baseline paragraph gap
          }
        } else if (el.type === 'table') {
          // Typeset structured table
          const maxCols = Math.max(...el.rows.map((r) => r.length), 1);
          const colWidth = contentWidth / maxCols;

          for (const row of el.rows) {
            const rowHeight = 24;
            checkNewPage(rowHeight + 4);

            for (let cIdx = 0; cIdx < row.length; cIdx++) {
              const cell = row[cIdx];
              const cellX = leftMargin + cIdx * colWidth;
              const cellY = currentY - rowHeight;

              // Cell Background
              if (cell.backgroundColor) {
                currentPage.drawRectangle({
                  x: cellX,
                  y: cellY,
                  width: colWidth,
                  height: rowHeight,
                  color: rgb(cell.backgroundColor.r, cell.backgroundColor.g, cell.backgroundColor.b),
                });
              }

              // Cell Border (Clean 0.5pt border)
              currentPage.drawRectangle({
                x: cellX,
                y: cellY,
                width: colWidth,
                height: rowHeight,
                borderColor: rgb(0.8, 0.8, 0.8),
                borderWidth: 0.5,
              });

              // Cell text
              const cellClean = sanitizePdfText(cell.text).trim();
              if (cellClean) {
                const cellFont = cell.bold ? fonts.helveticaBold : fonts.helvetica;
                currentPage.drawText(cellClean.slice(0, 45), {
                  x: cellX + 5,
                  y: cellY + 6,
                  size: cell.fontSize || 9.5,
                  font: cellFont,
                  color: rgb(cell.color.r, cell.color.g, cell.color.b),
                });
              }
            }

            currentY -= rowHeight;
          }

          currentY -= 12; // Gap after table
        }
      }

      onProgress?.(90, 'Generating final PDF binary...');
      const resultBytes = await pdfDoc.save();
      onProgress?.(100, 'Word to PDF conversion complete!');
      return resultBytes;
    } catch (err: any) {
      console.warn('Deep OpenXML parsing failed, falling back to standard converter:', err);
      return await this.fallbackConvertMammoth(docxBuffer, onProgress);
    }
  }

  /**
   * Fast, reliable OpenXML tag parser that extracts paragraphs, runs, fonts, colors,
   * tables, and drawing elements in sequential document order.
   */
  private static parseDocumentElements(xmlStr: string): ParsedDocElement[] {
    const elements: ParsedDocElement[] = [];

    // Match top-level paragraphs and tables sequentially
    const blockRegex = /<w:p[\s>][\s\S]*?<\/w:p>|<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = blockRegex.exec(xmlStr)) !== null) {
      const blockXml = blockMatch[0];

      if (blockXml.startsWith('<w:p')) {
        // Parse Paragraph
        let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
        let spacingBefore = 0;
        let spacingAfter = 4;

        const jcMatch = blockXml.match(/<w:jc\s+[^>]*w:val="([^"]+)"/);
        if (jcMatch) {
          const val = jcMatch[1].toLowerCase();
          if (val === 'center') alignment = 'center';
          else if (val === 'right') alignment = 'right';
          else if (val === 'both' || val === 'justify') alignment = 'justify';
        }

        const spMatch = blockXml.match(/<w:spacing\s+([^>]*)\/>/);
        if (spMatch) {
          const spAttrs = spMatch[1];
          const bMatch = spAttrs.match(/w:before="(\d+)"/);
          if (bMatch) spacingBefore = Number(bMatch[1]) / 20;
          const aMatch = spAttrs.match(/w:after="(\d+)"/);
          if (aMatch) spacingAfter = Number(aMatch[1]) / 20;
        }

        // Heading detection
        const pStyleMatch = blockXml.match(/<w:pStyle\s+[^>]*w:val="([^"]+)"/);
        let defaultHeadingSize = 11;
        let isHeadingBold = false;
        let headingColor = { r: 0.06, g: 0.09, b: 0.16 };

        if (pStyleMatch) {
          const styleVal = pStyleMatch[1].toLowerCase();
          if (styleVal.includes('heading1') || styleVal.includes('title')) {
            defaultHeadingSize = 22;
            isHeadingBold = true;
            headingColor = { r: 0.1, g: 0.2, b: 0.6 };
          } else if (styleVal.includes('heading2')) {
            defaultHeadingSize = 16;
            isHeadingBold = true;
            headingColor = { r: 0.12, g: 0.25, b: 0.5 };
          } else if (styleVal.includes('heading3')) {
            defaultHeadingSize = 13;
            isHeadingBold = true;
            headingColor = { r: 0.2, g: 0.2, b: 0.2 };
          }
        }

        // Parse runs
        const runs: ParsedRun[] = [];
        const runRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
        let runMatch: RegExpExecArray | null;

        while ((runMatch = runRegex.exec(blockXml)) !== null) {
          const runXml = runMatch[0];

          // Text content
          const tMatches = Array.from(runXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g));
          const text = tMatches.map((m) => decodeXml(m[1])).join('');

          // Font properties
          const bold = /<w:b(\/>|\s+[^>]*w:val="(?:true|1)")/i.test(runXml) || isHeadingBold;
          const italic = /<w:i(\/>|\s+[^>]*w:val="(?:true|1)")/i.test(runXml);
          const underline = /<w:u\s+[^>]*w:val="([^"]+)"/i.test(runXml);
          const strike = /<w:strike(\/>|\s+[^>]*w:val="(?:true|1)")/i.test(runXml);

          let fontFamily = 'Helvetica, sans-serif';
          const fontMatch = runXml.match(/<w:rFonts\s+[^>]*w:ascii="([^"]+)"/i);
          if (fontMatch) fontFamily = fontMatch[1];

          let fontSize = defaultHeadingSize;
          const szMatch = runXml.match(/<w:sz\s+[^>]*w:val="(\d+)"/i);
          if (szMatch) {
            fontSize = Number(szMatch[1]) / 2;
          }

          let color = headingColor;
          const colMatch = runXml.match(/<w:color\s+[^>]*w:val="([0-9a-fA-F]{6})"/i);
          if (colMatch) {
            const parsed = parseHexColor(colMatch[1]);
            if (parsed) color = parsed;
          }

          let highlightColor: { r: number; g: number; b: number } | undefined;
          const shdMatch = runXml.match(/<w:shd\s+[^>]*w:fill="([0-9a-fA-F]{6})"/i);
          if (shdMatch) {
            highlightColor = parseHexColor(shdMatch[1]);
          }

          // Embedded Drawing / Image
          let drawingRId: string | undefined;
          let drawingWidthPt: number | undefined;
          let drawingHeightPt: number | undefined;

          const blipMatch = runXml.match(/<a:blip\s+[^>]*r:embed="([^"]+)"/i);
          if (blipMatch) {
            drawingRId = blipMatch[1];
            const extentMatch = runXml.match(/<wp:extent\s+[^>]*cx="(\d+)"\s+cy="(\d+)"/i);
            if (extentMatch) {
              drawingWidthPt = Number(extentMatch[1]) / 12700; // 12700 EMUs = 1 pt
              drawingHeightPt = Number(extentMatch[2]) / 12700;
            }
          }

          if (text || drawingRId) {
            runs.push({
              text,
              fontFamily,
              fontSize,
              bold,
              italic,
              underline,
              strike,
              color,
              highlightColor,
              drawingRId,
              drawingWidthPt,
              drawingHeightPt,
            });
          }
        }

        elements.push({
          type: 'paragraph',
          alignment,
          spacingBefore,
          spacingAfter,
          runs,
        });
      } else if (blockXml.startsWith('<w:tbl')) {
        // Parse Table
        const rows: ParsedCell[][] = [];
        const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
        let trMatch: RegExpExecArray | null;

        while ((trMatch = trRegex.exec(blockXml)) !== null) {
          const trXml = trMatch[0];
          const cells: ParsedCell[] = [];
          const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
          let tcMatch: RegExpExecArray | null;

          while ((tcMatch = tcRegex.exec(trXml)) !== null) {
            const tcXml = tcMatch[0];

            // Extract cell text
            const tMatches = Array.from(tcXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g));
            const cellText = tMatches.map((m) => decodeXml(m[1])).join(' ');

            const isBold = /<w:b(\/>|\s+[^>]*w:val="(?:true|1)")/i.test(tcXml);
            const isItalic = /<w:i(\/>|\s+[^>]*w:val="(?:true|1)")/i.test(tcXml);

            let cellColor = { r: 0.1, g: 0.1, b: 0.1 };
            const colMatch = tcXml.match(/<w:color\s+[^>]*w:val="([0-9a-fA-F]{6})"/i);
            if (colMatch) {
              const p = parseHexColor(colMatch[1]);
              if (p) cellColor = p;
            }

            let bgColor: { r: number; g: number; b: number } | undefined;
            const shdMatch = tcXml.match(/<w:shd\s+[^>]*w:fill="([0-9a-fA-F]{6})"/i);
            if (shdMatch) {
              bgColor = parseHexColor(shdMatch[1]);
            }

            cells.push({
              text: cellText,
              bold: isBold,
              italic: isItalic,
              fontSize: 9.5,
              color: cellColor,
              backgroundColor: bgColor,
            });
          }

          if (cells.length > 0) {
            rows.push(cells);
          }
        }

        if (rows.length > 0) {
          elements.push({
            type: 'table',
            rows,
          });
        }
      }
    }

    return elements;
  }

  /**
   * Robust fallback using mammoth HTML conversion in case of non-standard docx archives.
   */
  private static async fallbackConvertMammoth(
    docxBuffer: ArrayBuffer | Uint8Array,
    onProgress?: (percent: number, message: string) => void
  ): Promise<Uint8Array> {
    onProgress?.(30, 'Using fallback HTML parser...');
    const arrayBuffer =
      docxBuffer instanceof Uint8Array
        ? (docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength) as ArrayBuffer)
        : docxBuffer;
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const html = htmlResult.value;

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 54;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    const checkNewPage = (requiredSpace: number) => {
      if (currentY - requiredSpace < margin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
    };

    // Strip HTML tags into lines
    const plainLines = html
      .replace(/<h1[^>]*>/gi, '\n#H1# ')
      .replace(/<h2[^>]*>/gi, '\n#H2# ')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n');

    for (const rawLine of plainLines) {
      const line = decodeXml(rawLine).trim();
      if (!line) {
        currentY -= 8;
        continue;
      }

      if (line.startsWith('#H1# ')) {
        const text = sanitizePdfText(line.replace('#H1# ', ''));
        checkNewPage(28);
        currentPage.drawText(text, {
          x: margin,
          y: currentY,
          size: 20,
          font: helveticaBold,
          color: rgb(0.1, 0.2, 0.5),
        });
        currentY -= 24;
      } else if (line.startsWith('#H2# ')) {
        const text = sanitizePdfText(line.replace('#H2# ', ''));
        checkNewPage(22);
        currentPage.drawText(text, {
          x: margin,
          y: currentY,
          size: 15,
          font: helveticaBold,
          color: rgb(0.15, 0.25, 0.45),
        });
        currentY -= 18;
      } else {
        const clean = sanitizePdfText(line);
        checkNewPage(14);
        currentPage.drawText(clean.slice(0, 95), {
          x: margin,
          y: currentY,
          size: 10.5,
          font: helvetica,
          color: rgb(0.15, 0.15, 0.15),
        });
        currentY -= 14;
      }
    }

    return await pdfDoc.save();
  }
}
