import * as pdfjsLib from 'pdfjs-dist';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageOrientation,
  UnderlineType,
  Packer,
} from 'docx';
import mammoth from 'mammoth';
import { OcrEngine } from '../ocr/ocrEngine';

export interface TextRunData {
  text: string;
  x: number; // pt from left
  y: number; // pt from top
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  color: string; // 6-char hex without '#'
}

export interface ExtractedImage {
  x: number;
  y: number;
  width: number;
  height: number;
  pngBytes: Uint8Array;
}

export interface VisualLine {
  y: number;
  height: number;
  x: number;
  width: number;
  runs: TextRunData[];
}

export interface TableColumn {
  startX: number;
  widthPt: number;
  widthTwips: number;
}

export interface ConversionValidationResult {
  passed: boolean;
  pageCount: number;
  textExtractedCount: number;
  fileSizeBytes: number;
  errors: string[];
}

// Adler32 & CRC32 for self-contained PNG encoding
function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let c = (crc ^ buf[i]) & 0xff;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encodes RGBA pixel buffer to standard PNG binary (zero external dependencies).
 */
export function encodeRawRgbaToPng(
  width: number,
  height: number,
  rgba: Uint8Array | Uint8ClampedArray
): Uint8Array {
  // If in browser environment with Canvas, use native encoder if available
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const binary = atob(dataUrl.split(',')[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
    } catch {
      // Fall through to pure JS encoder
    }
  }

  // Pure JS uncompressed Deflate block PNG generator
  const rowBytes = width * 4;
  const rawLen = (rowBytes + 1) * height;
  const raw = new Uint8Array(rawLen);
  for (let y = 0; y < height; y++) {
    raw[(rowBytes + 1) * y] = 0; // Filter: None
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), (rowBytes + 1) * y + 1);
  }

  const maxBlock = 65535;
  const blockCount = Math.ceil(raw.length / maxBlock) || 1;
  const zlibLen = 2 + blockCount * 5 + raw.length + 4;
  const zlib = new Uint8Array(zlibLen);
  zlib[0] = 0x78;
  zlib[1] = 0x01; // CMF, FLG
  let offset = 2;
  for (let i = 0; i < blockCount; i++) {
    const isLast = i === blockCount - 1;
    const start = i * maxBlock;
    const end = Math.min(raw.length, start + maxBlock);
    const len = end - start;
    zlib[offset++] = isLast ? 0x01 : 0x00;
    zlib[offset++] = len & 0xff;
    zlib[offset++] = (len >> 8) & 0xff;
    zlib[offset++] = (~len) & 0xff;
    zlib[offset++] = ((~len) >> 8) & 0xff;
    zlib.set(raw.subarray(start, end), offset);
    offset += len;
  }
  const adler = adler32(raw);
  zlib[offset++] = (adler >>> 24) & 0xff;
  zlib[offset++] = (adler >>> 16) & 0xff;
  zlib[offset++] = (adler >>> 8) & 0xff;
  zlib[offset++] = adler & 0xff;

  function makeChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 8);
    const typeAndData = chunk.subarray(4, 8 + data.length);
    dv.setUint32(8 + data.length, crc32(typeAndData), false);
    return chunk;
  }

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6; // 8-bit RGBA
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', zlib);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const totalLen = sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let pos = 0;
  png.set(sig, pos);
  pos += sig.length;
  png.set(ihdrChunk, pos);
  pos += ihdrChunk.length;
  png.set(idatChunk, pos);
  pos += idatChunk.length;
  png.set(iendChunk, pos);
  pos += iendChunk.length;
  return png;
}

function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function cleanHexColor(r: number, g: number, b: number): string {
  const rHex = Math.round(Math.max(0, Math.min(1, r)) * 255)
    .toString(16)
    .padStart(2, '0');
  const gHex = Math.round(Math.max(0, Math.min(1, g)) * 255)
    .toString(16)
    .padStart(2, '0');
  const bHex = Math.round(Math.max(0, Math.min(1, b)) * 255)
    .toString(16)
    .padStart(2, '0');
  const hex = `${rHex}${gHex}${bHex}`.toLowerCase();
  // Charcoal / black normalization
  if (hex === '000000' || hex === '111827' || hex === '0f172a') return '000000';
  return hex;
}

function mapFontFamily(rawName: string): string {
  const lower = rawName.toLowerCase();
  if (lower.includes('times') || lower.includes('serif') || lower.includes('roman')) {
    return 'Times New Roman';
  }
  if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas')) {
    return 'Courier New';
  }
  if (lower.includes('georgia')) return 'Georgia';
  if (lower.includes('garamond')) return 'Garamond';
  if (lower.includes('verdana')) return 'Verdana';
  if (lower.includes('arial') || lower.includes('helvetica') || lower.includes('sans')) {
    return 'Arial';
  }
  return 'Calibri';
}

export class PdfToWordEngine {
  /**
   * Converts a PDF binary into a high-fidelity Microsoft Word (.docx) document,
   * preserving page geometry, orientation, margins, text runs, typography,
   * tabular alignment, and visual images.
   */
  static async convertPdfToDocx(
    pdfBytes: Uint8Array,
    onProgress?: (progressPercent: number, message: string) => void
  ): Promise<Uint8Array> {
    onProgress?.(8, 'Parsing document structure...');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: '' });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const sections = [];
    let totalTextRunsCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      onProgress?.(
        Math.round(10 + (pageNum / numPages) * 75),
        `Extracting layout & typography (Page ${pageNum} of ${numPages})...`
      );

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidthPt = viewport.width;
      const pageHeightPt = viewport.height;
      const isLandscape = pageWidthPt > pageHeightPt;

      // 1. Extract Operator List for text colors & image objects
      const ops = await page.getOperatorList();
      const textColors: { r: number; g: number; b: number }[] = [];
      let currentColor = { r: 0, g: 0, b: 0 };

      const matrixStack: number[][] = [];
      let curTransform = [1, 0, 0, 1, 0, 0];
      const pageImages: ExtractedImage[] = [];

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (fn === pdfjsLib.OPS.save) {
          matrixStack.push([...curTransform]);
        } else if (fn === pdfjsLib.OPS.restore) {
          curTransform = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
        } else if (fn === pdfjsLib.OPS.transform) {
          curTransform = multiplyTransform(curTransform, args);
        } else if (fn === pdfjsLib.OPS.setFillRGBColor) {
          currentColor = { r: args[0], g: args[1], b: args[2] };
        } else if (fn === pdfjsLib.OPS.setFillGray) {
          currentColor = { r: args[0], g: args[0], b: args[0] };
        } else if (fn === pdfjsLib.OPS.setFillCMYKColor) {
          const k = args[3];
          currentColor = {
            r: (1 - args[0]) * (1 - k),
            g: (1 - args[1]) * (1 - k),
            b: (1 - args[2]) * (1 - k),
          };
        } else if (fn === pdfjsLib.OPS.showText || fn === (pdfjsLib.OPS as any).showSpans) {
          textColors.push({ ...currentColor });
        } else if (fn === pdfjsLib.OPS.paintImageXObject) {
          const imgName = args[0];
          const imgX = Math.round(curTransform[4]);
          const imgY_bottom = curTransform[5];
          const imgW = Math.round(Math.abs(curTransform[0]));
          const imgH = Math.round(Math.abs(curTransform[3]));
          const imgY_top = Math.round(pageHeightPt - (imgY_bottom + imgH));

          if (imgW > 8 && imgH > 8) {
            try {
              let imgObj = (page.objs as any).get(imgName);
              if (!imgObj) {
                imgObj = await new Promise((resolve) => {
                  (page.objs as any).get(imgName, (res: any) => resolve(res));
                });
              }

              if (imgObj && imgObj.data && imgObj.width && imgObj.height) {
                const pngBytes = encodeRawRgbaToPng(imgObj.width, imgObj.height, imgObj.data);
                pageImages.push({
                  x: Math.max(0, imgX),
                  y: Math.max(0, imgY_top),
                  width: imgW,
                  height: imgH,
                  pngBytes,
                });
              }
            } catch {
              // Ignore individual image load failure
            }
          }
        }
      }

      // 2. Extract Text Runs
      const textContent = await page.getTextContent();
      const rawRuns: TextRunData[] = [];
      let colorIdx = 0;

      for (const item of textContent.items as any[]) {
        if (!item.str || item.str.trim() === '') continue;
        const tx = item.transform || [1, 0, 0, 1, 0, 0];
        const scaleX = tx[0];
        const scaleY = tx[3];
        const transX = tx[4];
        const transY = tx[5];

        const fontSize = Math.round(Math.abs(scaleY) || Math.hypot(scaleX, tx[1]) || 11);
        const width = item.width || Math.abs(scaleX) * (item.str.length * 0.55);
        const height = item.height || fontSize * 1.2;

        const x = Math.round(transX);
        const y = Math.round(pageHeightPt - transY - fontSize);

        const rgb = textColors[colorIdx] || currentColor;
        colorIdx++;
        const hexColor = cleanHexColor(rgb.r, rgb.g, rgb.b);

        const style = textContent.styles ? (textContent.styles as any)[item.fontName] : null;
        let fontName = style?.fontFamily || item.fontName || 'Calibri';
        let isBold = false;
        let isItalic = false;

        try {
          const commonObj = (page as any).commonObjs?.get?.(item.fontName);
          if (commonObj) {
            if (commonObj.name) fontName = commonObj.name;
            if (commonObj.bold) isBold = true;
            if (commonObj.italic) isItalic = true;
          }
        } catch {
          // ignore
        }

        const nameLower = (fontName + ' ' + (item.fontName || '')).toLowerCase();
        if (
          nameLower.includes('bold') ||
          nameLower.includes('black') ||
          nameLower.includes('heavy') ||
          nameLower.includes('semibold') ||
          nameLower.includes('700') ||
          nameLower.includes('800') ||
          nameLower.includes('900')
        ) {
          isBold = true;
        }
        if (
          nameLower.includes('italic') ||
          nameLower.includes('oblique') ||
          nameLower.includes('slant')
        ) {
          isItalic = true;
        }

        const fontFamily = mapFontFamily(nameLower);

        rawRuns.push({
          text: item.str,
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.max(8, Math.round(width)),
          height: Math.max(fontSize, Math.round(height)),
          fontSize,
          fontName,
          fontFamily,
          isBold,
          isItalic,
          isUnderline: nameLower.includes('underline'),
          color: hexColor,
        });
      }

      totalTextRunsCount += rawRuns.length;

      // 3. Compute Page Content Bounds & Dynamic Margins
      let minContentX = 72;
      let maxContentX = pageWidthPt - 72;
      if (rawRuns.length > 0) {
        minContentX = Math.min(...rawRuns.map((r) => r.x));
        maxContentX = Math.max(...rawRuns.map((r) => r.x + r.width));
      }

      const leftMarginPt = Math.max(24, Math.min(72, minContentX));
      const rightMarginPt = Math.max(24, Math.min(72, pageWidthPt - maxContentX));
      const topMarginPt = 48;
      const bottomMarginPt = 48;

      const pageLeftMarginTwips = Math.round(leftMarginPt * 20);

      // 4. Group Text Runs into Visual Lines
      rawRuns.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 3.5) return a.y - b.y;
        return a.x - b.x;
      });

      const visualLines: VisualLine[] = [];
      let currentLineRuns: TextRunData[] = [];
      let lineY = -1;

      for (const run of rawRuns) {
        if (lineY === -1 || Math.abs(run.y - lineY) <= Math.max(3.5, run.fontSize * 0.3)) {
          currentLineRuns.push(run);
          if (lineY === -1) lineY = run.y;
        } else {
          currentLineRuns.sort((a, b) => a.x - b.x);
          const minX = currentLineRuns[0].x;
          const last = currentLineRuns[currentLineRuns.length - 1];
          const maxX = last.x + last.width;
          visualLines.push({
            y: lineY,
            height: Math.max(...currentLineRuns.map((r) => r.height)),
            x: minX,
            width: maxX - minX,
            runs: currentLineRuns,
          });

          currentLineRuns = [run];
          lineY = run.y;
        }
      }

      if (currentLineRuns.length > 0) {
        currentLineRuns.sort((a, b) => a.x - b.x);
        const minX = currentLineRuns[0].x;
        const last = currentLineRuns[currentLineRuns.length - 1];
        const maxX = last.x + last.width;
        visualLines.push({
          y: lineY,
          height: Math.max(...currentLineRuns.map((r) => r.height)),
          x: minX,
          width: maxX - minX,
          runs: currentLineRuns,
        });
      }

      // 5. Structure Document Elements (Headings, Tables, Paragraphs, Images)
      const pageElements: (Paragraph | Table)[] = [];

      if (visualLines.length === 0) {
        // Scanned page fallback: embed page image & OCR recognized lines
        if (pageImages.length > 0) {
          for (const img of pageImages) {
            pageElements.push(
              new Paragraph({
                spacing: { before: 120, after: 120 },
                children: [
                  new ImageRun({
                    data: img.pngBytes,
                    type: 'png',
                    transformation: {
                      width: Math.max(16, Math.round(img.width * 1.333)),
                      height: Math.max(16, Math.round(img.height * 1.333)),
                    },
                  }),
                ],
              })
            );
          }
        } else {
          // Render page to canvas and embed as visual page image
          try {
            if (typeof document !== 'undefined') {
              const offCanvas = document.createElement('canvas');
              const hrViewport = page.getViewport({ scale: 2.0 });
              offCanvas.width = hrViewport.width;
              offCanvas.height = hrViewport.height;
              const ctx = offCanvas.getContext('2d');
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport: hrViewport }).promise;
                const ocr = await OcrEngine.recognizeLines(offCanvas);
                const dataUrl = offCanvas.toDataURL('image/png');
                const binary = atob(dataUrl.split(',')[1]);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                pageElements.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: bytes,
                        type: 'png',
                        transformation: {
                          width: Math.round(pageWidthPt * 1.333),
                          height: Math.round(pageHeightPt * 1.333),
                        },
                      }),
                    ],
                  })
                );

                if (ocr.lines.length > 0) {
                  for (const ocrLine of ocr.lines) {
                    pageElements.push(
                      new Paragraph({
                        spacing: { after: 120 },
                        children: [
                          new TextRun({
                            text: ocrLine.text,
                            font: 'Calibri',
                            size: 22,
                          }),
                        ],
                      })
                    );
                  }
                }
              }
            }
          } catch {
            // Clean fallback without debugging strings
          }
        }
      } else {
        // Group consecutive lines into tables if columns are detected
        let lineIdx = 0;
        let prevY = topMarginPt;

        while (lineIdx < visualLines.length) {
          const line = visualLines[lineIdx];

          // Check if line has multiple horizontal column clusters (gap > 28pt)
          const clusters: TextRunData[][] = [];
          let currentCluster: TextRunData[] = [line.runs[0]];

          for (let r = 1; r < line.runs.length; r++) {
            const prevRun = line.runs[r - 1];
            const curRun = line.runs[r];
            const gap = curRun.x - (prevRun.x + prevRun.width);
            if (gap > 28) {
              clusters.push(currentCluster);
              currentCluster = [curRun];
            } else {
              currentCluster.push(curRun);
            }
          }
          clusters.push(currentCluster);

          // If line has 2+ columns, check if subsequent lines also align (Table block)
          if (clusters.length >= 2) {
            const tableLines = [line];
            let nextIdx = lineIdx + 1;

            while (nextIdx < visualLines.length) {
              const nextLine = visualLines[nextIdx];
              if (nextLine.y - line.y > 200) break; // too far away

              // Check if nextLine also has multiple clusters
              let hasGap = false;
              for (let r = 1; r < nextLine.runs.length; r++) {
                if (nextLine.runs[r].x - (nextLine.runs[r - 1].x + nextLine.runs[r - 1].width) > 24) {
                  hasGap = true;
                  break;
                }
              }

              if (hasGap) {
                tableLines.push(nextLine);
                nextIdx++;
              } else {
                break;
              }
            }

            // Construct structured Table
            const columnXStarts = new Set<number>();
            tableLines.forEach((tLine) => {
              tLine.runs.forEach((r) => columnXStarts.add(Math.round(r.x / 20) * 20));
            });
            const sortedStarts = Array.from(columnXStarts).sort((a, b) => a - b);
            const numCols = Math.max(2, Math.min(6, sortedStarts.length));
            const colWidthTwips = Math.round(((pageWidthPt - leftMarginPt - rightMarginPt) / numCols) * 20);

            const tableRows: TableRow[] = tableLines.map((tLine) => {
              const cells: TableCell[] = [];
              for (let c = 0; c < numCols; c++) {
                const colStart = sortedStarts[c] || 0;
                const colEnd = sortedStarts[c + 1] || Infinity;
                const cellRuns = tLine.runs.filter((r) => r.x >= colStart - 10 && r.x < colEnd - 10);

                cells.push(
                  new TableCell({
                    width: { size: colWidthTwips, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children:
                          cellRuns.length > 0
                            ? cellRuns.map(
                                (r) =>
                                  new TextRun({
                                    text: r.text + ' ',
                                    font: r.fontFamily,
                                    size: Math.max(14, Math.round(r.fontSize * 2)),
                                    bold: r.isBold,
                                    italics: r.isItalic,
                                    color: r.color,
                                  })
                              )
                            : [new TextRun({ text: '' })],
                      }),
                    ],
                  })
                );
              }

              return new TableRow({ children: cells });
            });

            pageElements.push(
              new Table({
                width: {
                  size: Math.round((pageWidthPt - leftMarginPt - rightMarginPt) * 20),
                  type: WidthType.DXA,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.NONE },
                  insideVertical: { style: BorderStyle.NONE },
                },
                rows: tableRows,
              })
            );

            prevY = tableLines[tableLines.length - 1].y + 16;
            lineIdx = nextIdx;
            continue;
          }

          // Single-column lines: Group consecutive lines that belong to the same paragraph
          const paragraphLines: VisualLine[] = [line];
          let nextLineIdx = lineIdx + 1;

          // Check if this initial line is a heading
          const initialAvgSize =
            Math.round(line.runs.reduce((acc, r) => acc + r.fontSize, 0) / line.runs.length) || 11;
          const isInitialHeading = initialAvgSize >= 15;

          // If not a heading, look ahead to group consecutive lines of the same paragraph
          if (!isInitialHeading) {
            while (nextLineIdx < visualLines.length) {
              const candLine = visualLines[nextLineIdx];
              // Check if candLine is a multi-column line (table)
              let isCandTable = false;
              for (let r = 1; r < candLine.runs.length; r++) {
                if (candLine.runs[r].x - (candLine.runs[r - 1].x + candLine.runs[r - 1].width) > 28) {
                  isCandTable = true;
                  break;
                }
              }
              if (isCandTable) break;

              const prevLineInPara = paragraphLines[paragraphLines.length - 1];
              const lineGap = candLine.y - (prevLineInPara.y + prevLineInPara.height);
              const candAvgSize =
                Math.round(candLine.runs.reduce((acc, r) => acc + r.fontSize, 0) / candLine.runs.length) || 11;

              // If candidate is a heading, stop
              if (candAvgSize >= 15) break;

              // If gap is consistent with line-height (<= 12pt) and font size matches
              if (lineGap <= Math.max(12, initialAvgSize * 1.2) && Math.abs(candAvgSize - initialAvgSize) <= 2) {
                paragraphLines.push(candLine);
                nextLineIdx++;
              } else {
                break;
              }
            }
          }

          const firstLine = paragraphLines[0];
          const verticalGap = Math.max(0, firstLine.y - prevY);
          const lastLine = paragraphLines[paragraphLines.length - 1];
          prevY = lastLine.y + lastLine.height;

          // Detect alignment based on first line
          let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
          const centerX = firstLine.x + firstLine.width / 2;
          if (firstLine.width < pageWidthPt * 0.75 && Math.abs(centerX - pageWidthPt / 2) < 20) {
            alignment = AlignmentType.CENTER;
          } else if (
            firstLine.width < pageWidthPt * 0.75 &&
            Math.abs(pageWidthPt - rightMarginPt - (firstLine.x + firstLine.width)) < 20
          ) {
            alignment = AlignmentType.RIGHT;
          }

          const indentTwips =
            alignment === AlignmentType.LEFT && firstLine.x > leftMarginPt + 12
              ? Math.max(0, Math.round((firstLine.x - leftMarginPt) * 20))
              : undefined;

          // Detect Headings
          let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined = undefined;
          if (initialAvgSize >= 20) {
            heading = HeadingLevel.HEADING_1;
          } else if (initialAvgSize >= 15) {
            heading = HeadingLevel.HEADING_2;
          } else if (initialAvgSize >= 13 && firstLine.runs.some((r) => r.isBold)) {
            heading = HeadingLevel.HEADING_3;
          }

          // Build runs for all lines in this paragraph
          const paragraphRuns: TextRun[] = [];
          for (let pIdx = 0; pIdx < paragraphLines.length; pIdx++) {
            const pLine = paragraphLines[pIdx];
            for (let rIdx = 0; rIdx < pLine.runs.length; rIdx++) {
              const r = pLine.runs[rIdx];
              const nextR = pLine.runs[rIdx + 1];

              let trailingSpace = false;
              if (!r.text.endsWith(' ')) {
                if (nextR) {
                  const gap = nextR.x - (r.x + r.width);
                  if (gap > 1.5) trailingSpace = true;
                } else {
                  trailingSpace = true;
                }
              }

              paragraphRuns.push(
                new TextRun({
                  text: r.text + (trailingSpace ? ' ' : ''),
                  font: r.fontFamily,
                  size: Math.max(14, Math.round(r.fontSize * 2)),
                  bold: r.isBold,
                  italics: r.isItalic,
                  underline: r.isUnderline ? { type: UnderlineType.SINGLE } : undefined,
                  color: r.color,
                })
              );
            }
          }

          pageElements.push(
            new Paragraph({
              alignment,
              heading,
              indent: indentTwips ? { left: indentTwips } : undefined,
              spacing: {
                before: Math.min(2400, Math.round(verticalGap * 20)),
                after: heading ? 120 : 80,
                line: Math.round(initialAvgSize * 24),
              },
              children: paragraphRuns,
            })
          );

          lineIdx = nextLineIdx;
        }

        // Insert images on this page
        for (const img of pageImages) {
          pageElements.push(
            new Paragraph({
              spacing: { before: 120, after: 120 },
              indent:
                img.x > leftMarginPt + 4
                  ? { left: Math.round((img.x - leftMarginPt) * 20) }
                  : undefined,
              children: [
                new ImageRun({
                  data: img.pngBytes,
                  type: 'png',
                  transformation: {
                    width: Math.max(16, Math.round(img.width * 1.333)),
                    height: Math.max(16, Math.round(img.height * 1.333)),
                  },
                }),
              ],
            })
          );
        }
      }

      // Convert page dimensions to twips
      const widthTwips = Math.round(pageWidthPt * 20);
      const heightTwips = Math.round(pageHeightPt * 20);

      sections.push({
        properties: {
          page: {
            size: {
              width: widthTwips,
              height: heightTwips,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: Math.round(topMarginPt * 20),
              right: Math.round(rightMarginPt * 20),
              bottom: Math.round(bottomMarginPt * 20),
              left: pageLeftMarginTwips,
            },
          },
        },
        children: pageElements,
      });
    }

    onProgress?.(90, 'Packaging DOCX OpenXML archive...');
    const doc = new Document({
      sections,
    });

    const docxBlob = await Packer.toBlob(doc);
    const docxBuffer = await docxBlob.arrayBuffer();
    const docxUint8 = new Uint8Array(docxBuffer);

    // 6. Fidelity Validation
    onProgress?.(95, 'Validating document fidelity & structure...');
    const validation = await this.validateConversion(docxUint8, numPages, totalTextRunsCount);
    if (!validation.passed) {
      throw new Error(`Word document validation failed: ${validation.errors.join('; ')}`);
    }

    onProgress?.(100, 'Conversion complete!');
    return docxUint8;
  }

  /**
   * Validates the generated Word document against source document metrics.
   */
  static async validateConversion(
    docxBytes: Uint8Array,
    expectedPageCount: number,
    totalTextRuns: number
  ): Promise<ConversionValidationResult> {
    const errors: string[] = [];
    const fileSizeBytes = docxBytes.byteLength;

    // Check OpenXML PK magic bytes (PK\x03\x04)
    if (
      docxBytes.length < 4 ||
      docxBytes[0] !== 0x50 ||
      docxBytes[1] !== 0x4b ||
      docxBytes[2] !== 0x03 ||
      docxBytes[3] !== 0x04
    ) {
      errors.push('Invalid OpenXML ZIP archive header');
    }

    if (fileSizeBytes < 1000) {
      errors.push('Output document is corrupted or unexpectedly small (< 1KB)');
    }

    let textExtractedCount = 0;
    try {
      const options =
        typeof Buffer !== 'undefined'
          ? { buffer: Buffer.from(docxBytes) }
          : {
              arrayBuffer: docxBytes.buffer.slice(
                docxBytes.byteOffset,
                docxBytes.byteOffset + docxBytes.byteLength
              ),
            };
      const mammothResult = await mammoth.extractRawText(options as any);
      const text = mammothResult.value || '';
      textExtractedCount = text.trim().length;

      // If source had text but generated docx extracted 0 text:
      if (totalTextRuns > 5 && textExtractedCount === 0) {
        errors.push('Generated Word document is blank; text was not written into paragraphs');
      }
    } catch (e: any) {
      errors.push(`Integrity inspection warning: ${e.message}`);
    }

    return {
      passed: errors.length === 0,
      pageCount: expectedPageCount,
      textExtractedCount,
      fileSizeBytes,
      errors,
    };
  }
}
