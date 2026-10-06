import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import type { AnnotationObject, EditableTextSpan } from '../../types/document';
import { PdfContentStreamEngine } from '../pdf/pdfContentStreamEngine';
import { sanitizeWinAnsiText } from '../../utils/pdfSanitize';

function parseHexColor(hex: string | undefined, defaultColor = { r: 0, g: 0, b: 0 }) {
  if (!hex || !hex.startsWith('#')) return defaultColor;
  let clean = hex.slice(1);
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return defaultColor;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export class AnnotationBurner {
  /**
   * Burns all visual overlay annotations and content-stream text replacements directly into the PDF document binary.
   */
  static async burnAllEditsAndAnnotations(
    pdfBytes: Uint8Array,
    annotations: AnnotationObject[],
    editedSpansByPage?: Record<number, EditableTextSpan[]>
  ): Promise<Uint8Array> {
    // Byte-level equivalence guarantee: If nothing was modified or added, return original bytes unmodified.
    const hasModifiedSpans =
      editedSpansByPage &&
      Object.values(editedSpansByPage).some((spans) => spans && spans.some((s) => s.isModified));
    const hasAnnotations = annotations && annotations.length > 0;
    if (!hasModifiedSpans && !hasAnnotations) {
      return pdfBytes;
    }

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // 1. First apply true content-stream text replacements if any
    if (editedSpansByPage && Object.keys(editedSpansByPage).length > 0) {
      await PdfContentStreamEngine.applyTextReplacements(pdfDoc, editedSpansByPage);

      // 2. Draw any OCR-generated text spans directly onto the page
      const docPages = pdfDoc.getPages();
      for (const pIdxStr in editedSpansByPage) {
        const pIdx = Number(pIdxStr);
        const spans = editedSpansByPage[pIdx] || [];
        const page = docPages[pIdx];
        if (!page) continue;
        const { height: pageHeight } = page.getSize();

        for (const span of spans) {
          if (span.isFromOcr && span.isModified) {
            const font = await pdfDoc.embedFont(
              span.fontWeight === 'bold' ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
            );
            const size = span.fontSize || 12;
            const pdfY = span.pdfY !== undefined ? span.pdfY : (pageHeight - span.y - span.height);
            page.drawText(span.currentText, {
              x: span.pdfX !== undefined ? span.pdfX : span.x,
              y: pdfY,
              size,
              font,
              color: rgb(0.06, 0.09, 0.16),
            });
          }
        }
      }
    }

    if (!annotations || annotations.length === 0) {
      return await pdfDoc.save();
    }
    const pages = pdfDoc.getPages();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const courier = await pdfDoc.embedFont(StandardFonts.Courier);

    // Group annotations by pageIndex
    for (const annot of annotations) {
      if (annot.pageIndex < 0 || annot.pageIndex >= pages.length) continue;
      const page = pages[annot.pageIndex];
      const { height: pageHeight } = page.getSize();

      // Convert coordinates: in PDF coordinate system, (0,0) is bottom-left
      // In web canvas coordinate system, (0,0) is top-left
      const pdfX = annot.x;
      const pdfY = pageHeight - annot.y - annot.height;
      const opacity = annot.opacity !== undefined ? annot.opacity : 1.0;

      // Handle by type
      switch (annot.type) {
        case 'text': {
          if (!annot.text) break;
          let font = helvetica;
          if (annot.fontFamily === 'Times New Roman' || annot.fontFamily === 'serif') font = timesRoman;
          else if (annot.fontFamily === 'Courier' || annot.fontFamily === 'monospace') font = courier;
          else if (annot.fontWeight === 'bold') font = helveticaBold;
          else if (annot.fontStyle === 'italic') font = helveticaOblique;

          const size = annot.fontSize || 14;
          const colorObj = parseHexColor(annot.textColor, { r: 0.1, g: 0.1, b: 0.1 });
          const color = rgb(colorObj.r, colorObj.g, colorObj.b);

          // If background color is present, draw rect behind
          if (annot.backgroundColor && annot.backgroundColor !== 'transparent') {
            const bgObj = parseHexColor(annot.backgroundColor);
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: annot.width,
              height: annot.height,
              color: rgb(bgObj.r, bgObj.g, bgObj.b),
              opacity: opacity * 0.9,
            });
          }

          // Handle multi-line text with sanitization, alignment, and decorations
          const rawLines = annot.text.split('\n');
          const lineHeight = annot.lineHeight ? annot.lineHeight * size : size * 1.25;
          const sanitizedLines = rawLines.map((l) => sanitizeWinAnsiText(l));

          sanitizedLines.forEach((line, idx) => {
            if (!line) return;
            const lineY = pdfY + annot.height - (idx + 1) * lineHeight + (lineHeight - size);

            let effectiveSize = size;
            let baselineShift = 0;
            if (annot.verticalAlign === 'super') {
              effectiveSize = Math.max(6, Math.round(size * 0.7));
              baselineShift = size * 0.35;
            } else if (annot.verticalAlign === 'sub') {
              effectiveSize = Math.max(6, Math.round(size * 0.7));
              baselineShift = -size * 0.2;
            }

            const adjustedLineY = lineY + baselineShift;
            const charSpacing = annot.letterSpacing || 0;

            let lineWidth = 0;
            try {
              lineWidth = font.widthOfTextAtSize(line, effectiveSize) + (line.length - 1) * charSpacing;
            } catch {
              lineWidth = line.length * effectiveSize * 0.55 + (line.length - 1) * charSpacing;
            }

            let lineX = pdfX + 4;
            if (annot.textAlign === 'center') {
              lineX = pdfX + Math.max(0, (annot.width - lineWidth) / 2);
            } else if (annot.textAlign === 'right') {
              lineX = pdfX + Math.max(0, annot.width - lineWidth - 4);
            }

            if (charSpacing > 0 && line.length > 1) {
              let curCharX = lineX;
              for (let cIdx = 0; cIdx < line.length; cIdx++) {
                const ch = line[cIdx];
                page.drawText(ch, {
                  x: Math.max(0, curCharX),
                  y: Math.max(pdfY, adjustedLineY),
                  size: effectiveSize,
                  font,
                  color,
                  opacity,
                  rotate: annot.rotation ? degrees(annot.rotation) : undefined,
                });
                let chW = 0;
                try {
                  chW = font.widthOfTextAtSize(ch, effectiveSize);
                } catch {
                  chW = effectiveSize * 0.55;
                }
                curCharX += chW + charSpacing;
              }
            } else {
              page.drawText(line, {
                x: Math.max(0, lineX),
                y: Math.max(pdfY, adjustedLineY),
                size: effectiveSize,
                font,
                color,
                opacity,
                rotate: annot.rotation ? degrees(annot.rotation) : undefined,
              });
            }

            if (annot.underline) {
              page.drawLine({
                start: { x: Math.max(0, lineX), y: Math.max(0, adjustedLineY - 2) },
                end: { x: Math.max(0, lineX + lineWidth), y: Math.max(0, adjustedLineY - 2) },
                thickness: Math.max(1, effectiveSize * 0.08),
                color,
                opacity,
              });
            }

            if (annot.strikethrough) {
              page.drawLine({
                start: { x: Math.max(0, lineX), y: Math.max(0, adjustedLineY + effectiveSize * 0.35) },
                end: { x: Math.max(0, lineX + lineWidth), y: Math.max(0, adjustedLineY + effectiveSize * 0.35) },
                thickness: Math.max(1, effectiveSize * 0.08),
                color,
                opacity,
              });
            }
          });
          break;
        }

        case 'signature':
        case 'image': {
          if (!annot.imageDataUrl) break;
          try {
            let embeddedImg;
            if (annot.imageDataUrl.startsWith('data:image/png')) {
              embeddedImg = await pdfDoc.embedPng(annot.imageDataUrl);
            } else {
              embeddedImg = await pdfDoc.embedJpg(annot.imageDataUrl);
            }

            const theta = annot.rotation || 0;
            const alpha = -theta * (Math.PI / 180);
            const pdfCx = pdfX + annot.width / 2;
            const pdfCy = pdfY + annot.height / 2;
            const halfW = annot.width / 2;
            const halfH = annot.height / 2;
            const drawX = pdfCx - (halfW * Math.cos(alpha) - halfH * Math.sin(alpha));
            const drawY = pdfCy - (halfW * Math.sin(alpha) + halfH * Math.cos(alpha));

            page.drawImage(embeddedImg, {
              x: drawX,
              y: drawY,
              width: annot.width,
              height: annot.height,
              opacity,
              rotate: theta ? degrees(-theta) : undefined,
            });
          } catch (e) {
            console.warn('Failed to embed image/signature', e);
          }
          break;
        }

        case 'stamp': {
          const text =
            annot.stampText && annot.stampText !== 'CUSTOM'
              ? annot.stampText
              : annot.stampType && annot.stampType !== 'CUSTOM'
              ? annot.stampType
              : 'APPROVED';
          const customColorHex = annot.strokeColor || annot.textColor;
          let strokeObj;
          if (customColorHex) {
            strokeObj = parseHexColor(customColorHex);
          } else {
            const isRed = ['REJECTED', 'CONFIDENTIAL'].includes(text);
            strokeObj = isRed ? { r: 0.85, g: 0.15, b: 0.15 } : { r: 0.1, g: 0.6, b: 0.25 };
          }
          const strokeColor = rgb(strokeObj.r, strokeObj.g, strokeObj.b);

          const theta = annot.rotation || 0;
          const alpha = -theta * (Math.PI / 180);
          const pdfCx = pdfX + annot.width / 2;
          const pdfCy = pdfY + annot.height / 2;
          const halfW = annot.width / 2;
          const halfH = annot.height / 2;
          const drawX = pdfCx - (halfW * Math.cos(alpha) - halfH * Math.sin(alpha));
          const drawY = pdfCy - (halfW * Math.sin(alpha) + halfH * Math.cos(alpha));

          // Draw stamp border
          page.drawRectangle({
            x: drawX,
            y: drawY,
            width: annot.width,
            height: annot.height,
            borderColor: strokeColor,
            borderWidth: 2.5,
            opacity: opacity * 0.9,
            rotate: theta ? degrees(-theta) : undefined,
          });

          // Draw stamp label centered within the rotated stamp
          const stampFontSize = Math.min(annot.height * 0.45, 20);
          const textWidth = helveticaBold.widthOfTextAtSize(text, stampFontSize);
          const localTextDx = -textWidth / 2;
          const localTextDy = -stampFontSize / 2 + 2;
          const textX = pdfCx + (localTextDx * Math.cos(alpha) - localTextDy * Math.sin(alpha));
          const textY = pdfCy + (localTextDx * Math.sin(alpha) + localTextDy * Math.cos(alpha));

          page.drawText(text, {
            x: textX,
            y: textY,
            size: stampFontSize,
            font: helveticaBold,
            color: strokeColor,
            opacity,
            rotate: theta ? degrees(-theta) : undefined,
          });
          break;
        }

        case 'shape': {
          const stroke = parseHexColor(annot.strokeColor, { r: 0.2, g: 0.4, b: 0.8 });
          const strokeColor = rgb(stroke.r, stroke.g, stroke.b);
          const strokeWidth = annot.strokeWidth || 2;

          if (annot.shapeType === 'rectangle') {
            let fillColor;
            if (annot.fillColor && annot.fillColor !== 'transparent') {
              const f = parseHexColor(annot.fillColor);
              fillColor = rgb(f.r, f.g, f.b);
            }

            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: annot.width,
              height: annot.height,
              borderColor: strokeColor,
              borderWidth: strokeWidth,
              color: fillColor,
              opacity,
            });
          } else if (annot.shapeType === 'circle') {
            const xRadius = annot.width / 2;
            const yRadius = annot.height / 2;
            page.drawEllipse({
              x: pdfX + xRadius,
              y: pdfY + yRadius,
              xScale: xRadius,
              yScale: yRadius,
              borderColor: strokeColor,
              borderWidth: strokeWidth,
              opacity,
            });
          } else if (annot.shapeType === 'highlight') {
            const highlightColor = parseHexColor(annot.strokeColor || annot.fillColor || '#ffea00');
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: annot.width,
              height: annot.height,
              color: rgb(highlightColor.r, highlightColor.g, highlightColor.b),
              opacity: annot.opacity !== undefined ? annot.opacity : 0.35,
            });
          } else if (annot.shapeType === 'underline') {
            const lineColor = parseHexColor(annot.strokeColor || '#2563eb');
            page.drawLine({
              start: { x: pdfX, y: pdfY + 2 },
              end: { x: pdfX + annot.width, y: pdfY + 2 },
              thickness: annot.strokeWidth || 1.5,
              color: rgb(lineColor.r, lineColor.g, lineColor.b),
              opacity: annot.opacity !== undefined ? annot.opacity : 1.0,
            });
          } else if (annot.shapeType === 'strikethrough') {
            const lineColor = parseHexColor(annot.strokeColor || '#dc2626');
            const centerY = pdfY + annot.height / 2;
            page.drawLine({
              start: { x: pdfX, y: centerY },
              end: { x: pdfX + annot.width, y: centerY },
              thickness: annot.strokeWidth || 1.5,
              color: rgb(lineColor.r, lineColor.g, lineColor.b),
              opacity: annot.opacity !== undefined ? annot.opacity : 1.0,
            });
          } else if (annot.shapeType === 'line' || annot.shapeType === 'arrow') {
            page.drawLine({
              start: { x: pdfX, y: pdfY + annot.height },
              end: { x: pdfX + annot.width, y: pdfY },
              thickness: strokeWidth,
              color: strokeColor,
              opacity,
            });
          }
          break;
        }

        case 'highlight': {
          const highlightColor = parseHexColor(annot.strokeColor || annot.fillColor || '#ffea00');
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: annot.width,
            height: annot.height,
            color: rgb(highlightColor.r, highlightColor.g, highlightColor.b),
            opacity: annot.opacity !== undefined ? annot.opacity : 0.35,
          });
          break;
        }

        case 'underline': {
          const lineColor = parseHexColor(annot.strokeColor || '#2563eb');
          page.drawLine({
            start: { x: pdfX, y: pdfY + 2 },
            end: { x: pdfX + annot.width, y: pdfY + 2 },
            thickness: annot.strokeWidth || 1.5,
            color: rgb(lineColor.r, lineColor.g, lineColor.b),
            opacity: annot.opacity !== undefined ? annot.opacity : 1.0,
          });
          break;
        }

        case 'strikethrough': {
          const lineColor = parseHexColor(annot.strokeColor || '#dc2626');
          const centerY = pdfY + annot.height / 2;
          page.drawLine({
            start: { x: pdfX, y: centerY },
            end: { x: pdfX + annot.width, y: centerY },
            thickness: annot.strokeWidth || 1.5,
            color: rgb(lineColor.r, lineColor.g, lineColor.b),
            opacity: annot.opacity !== undefined ? annot.opacity : 1.0,
          });
          break;
        }

        case 'drawing': {
          if (!annot.points || annot.points.length < 2) break;
          const stroke = parseHexColor(annot.strokeColor, { r: 0.1, g: 0.1, b: 0.1 });
          const color = rgb(stroke.r, stroke.g, stroke.b);
          const thickness = annot.strokeWidth || 2.5;

          for (let p = 0; p < annot.points.length - 1; p++) {
            const p1 = annot.points[p];
            const p2 = annot.points[p + 1];

            page.drawLine({
              start: { x: p1.x, y: pageHeight - p1.y },
              end: { x: p2.x, y: pageHeight - p2.y },
              thickness,
              color,
              opacity,
            });
          }
          break;
        }

        case 'watermark': {
          if (annot.watermarkType === 'image' && annot.imageDataUrl) {
            try {
              let embeddedImg;
              if (annot.imageDataUrl.startsWith('data:image/png')) {
                embeddedImg = await pdfDoc.embedPng(annot.imageDataUrl);
              } else {
                embeddedImg = await pdfDoc.embedJpg(annot.imageDataUrl);
              }
              const theta = annot.rotation || 0;
              const alpha = -theta * (Math.PI / 180);
              const pdfCx = pdfX + annot.width / 2;
              const pdfCy = pdfY + annot.height / 2;
              const halfW = annot.width / 2;
              const halfH = annot.height / 2;
              const drawX = pdfCx - (halfW * Math.cos(alpha) - halfH * Math.sin(alpha));
              const drawY = pdfCy - (halfW * Math.sin(alpha) + halfH * Math.cos(alpha));

              page.drawImage(embeddedImg, {
                x: drawX,
                y: drawY,
                width: annot.width,
                height: annot.height,
                opacity: annot.opacity !== undefined ? annot.opacity : 0.25,
                rotate: theta ? degrees(-theta) : undefined,
              });
            } catch (e) {
              console.warn('Failed to embed watermark image', e);
            }
          } else if (annot.text) {
            const wmText = sanitizeWinAnsiText(annot.text);
            const wmFont = helveticaBold;
            const wmSize = annot.fontSize || 48;
            const wmOpacity = annot.opacity !== undefined ? annot.opacity : 0.25;
            const wmColorObj = parseHexColor(annot.textColor, { r: 0.8, g: 0.1, b: 0.1 });
            const wmColor = rgb(wmColorObj.r, wmColorObj.g, wmColorObj.b);
            const theta = annot.rotation || 0;
            const alpha = -theta * (Math.PI / 180);

            let textW = 0;
            try {
              textW = wmFont.widthOfTextAtSize(wmText, wmSize);
            } catch {
              textW = wmText.length * wmSize * 0.6;
            }
            const textH = wmSize;
            const pdfCx = pdfX + annot.width / 2;
            const pdfCy = pdfY + annot.height / 2;

            const localDx = -textW / 2;
            const localDy = -textH / 2;
            const textX = pdfCx + (localDx * Math.cos(alpha) - localDy * Math.sin(alpha));
            const textY = pdfCy + (localDx * Math.sin(alpha) + localDy * Math.cos(alpha));

            page.drawText(wmText, {
              x: textX,
              y: textY,
              size: wmSize,
              font: wmFont,
              color: wmColor,
              opacity: wmOpacity,
              rotate: theta ? degrees(-theta) : undefined,
            });
          }
          break;
        }
      }
    }

    return await pdfDoc.save();
  }

  static async burnAnnotations(
    pdfBytes: Uint8Array,
    annotations: AnnotationObject[]
  ): Promise<Uint8Array> {
    return this.burnAllEditsAndAnnotations(pdfBytes, annotations);
  }
}
