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

    // Embed standard fonts for guaranteed typographic reproduction
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const timesRomanBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const courier = await pdfDoc.embedFont(StandardFonts.Courier);
    const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
    const courierOblique = await pdfDoc.embedFont(StandardFonts.CourierOblique);
    const courierBoldOblique = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);

    const resolveFont = (family?: string, weight?: string, style?: string) => {
      const f = (family || '').toLowerCase();
      const isBold = weight === 'bold';
      const isItalic = style === 'italic';

      if (f.includes('times') || f.includes('serif') || f.includes('roman')) {
        if (isBold && isItalic) return timesRomanBoldItalic;
        if (isBold) return timesRomanBold;
        if (isItalic) return timesRomanItalic;
        return timesRoman;
      }
      if (f.includes('courier') || f.includes('mono') || f.includes('consolas')) {
        if (isBold && isItalic) return courierBoldOblique;
        if (isBold) return courierBold;
        if (isItalic) return courierOblique;
        return courier;
      }
      if (isBold && isItalic) return helveticaBoldOblique;
      if (isBold) return helveticaBold;
      if (isItalic) return helveticaOblique;
      return helvetica;
    };

    // 1. First apply true content-stream text replacements where exact matching runs exist
    let patchedSpanIds = new Set<string>();
    if (editedSpansByPage && Object.keys(editedSpansByPage).length > 0) {
      try {
        patchedSpanIds = await PdfContentStreamEngine.applyTextReplacements(pdfDoc, editedSpansByPage);
      } catch (err) {
        console.warn('In-stream text replacement encountered an issue, deferring to surgical replacement:', err);
      }
    }

    // 2. Surgical Text Replacement Strategy:
    // For every modified or deleted text span not patched directly into the PostScript stream,
    // cover the original text bounds and draw the replacement text with 100% styling fidelity.
    const docPages = pdfDoc.getPages();
    if (editedSpansByPage) {
      for (const [pIdxStr, spans] of Object.entries(editedSpansByPage)) {
        const pIdx = Number(pIdxStr);
        if (isNaN(pIdx) || pIdx < 0 || pIdx >= docPages.length) continue;
        const page = docPages[pIdx];
        if (!page) continue;
        const { height: pageHeight } = page.getSize();

        for (const span of spans) {
          if (!span.isModified && !span.isDeleted) continue;
          if (patchedSpanIds.has(span.id)) continue;

          const pdfX = span.pdfX !== undefined ? span.pdfX : span.x;
          // In PDF coordinates, transY is the font baseline
          const pdfBaseline = span.baseline !== undefined
            ? span.baseline
            : span.pdfY !== undefined
            ? span.pdfY
            : (pageHeight - span.y - span.fontSize);

          const size = span.fontSize || 12;
          const boxWidth = Math.max(span.width, 10);
          const boxHeight = Math.max(span.height, size * 1.15);

          const rawLines = (span.currentText || '').split('\n');
          const lineCount = Math.max(1, rawLines.length);
          const lineHeight = span.lineHeight ? (span.lineHeight > 3 ? span.lineHeight : span.lineHeight * size) : size * 1.25;

          // Localized mask: cover ONLY the exact original text bounds.
          // Bottom of descenders is baseline - (fontSize * 0.3).
          // Top of ascenders/caps is baseline + (fontSize * 0.95).
          const maskBottom = Math.max(0, pdfBaseline - (lineCount - 1) * lineHeight - size * 0.3 - 1);
          const maskTop = pdfBaseline + size * 0.95 + 1;
          const maskHeight = Math.max(boxHeight + 2, maskTop - maskBottom);

          // Localized mask: cover ONLY the exact original text bounds
          let maskColor = rgb(1, 1, 1);
          if (span.backgroundColor && span.backgroundColor !== 'transparent') {
            const bgObj = parseHexColor(span.backgroundColor);
            maskColor = rgb(bgObj.r, bgObj.g, bgObj.b);
          }

          page.drawRectangle({
            x: Math.max(0, pdfX - 1),
            y: maskBottom,
            width: boxWidth + 2,
            height: maskHeight,
            color: maskColor,
            opacity: 1.0,
          });

          // If deleted or empty, the mask cleanly removes the text from the document
          if (span.isDeleted || !span.currentText || span.currentText.trim() === '') {
            continue;
          }

          // Draw the replacement text with exact font, size, color, and formatting
          const font = resolveFont(span.fontFamily, span.fontWeight, span.fontStyle);
          const colorObj = parseHexColor(span.color, { r: 0.06, g: 0.09, b: 0.16 });
          const color = rgb(colorObj.r, colorObj.g, colorObj.b);

          const sanitizedLines = rawLines.map((l) => sanitizeWinAnsiText(l));

          sanitizedLines.forEach((line, idx) => {
            if (!line) return;
            // Line 0 baseline is pdfBaseline, subsequent lines shift down by lineHeight
            const lineY = pdfBaseline - idx * lineHeight;

            let effectiveSize = size;
            let baselineShift = 0;
            if (span.verticalAlign === 'super') {
              effectiveSize = Math.max(6, Math.round(size * 0.7));
              baselineShift = size * 0.35;
            } else if (span.verticalAlign === 'sub') {
              effectiveSize = Math.max(6, Math.round(size * 0.7));
              baselineShift = -size * 0.2;
            }

            const adjustedLineY = lineY + baselineShift;
            const charSpacing = span.letterSpacing || 0;

            let lineWidth = 0;
            try {
              lineWidth = font.widthOfTextAtSize(line, effectiveSize) + (line.length - 1) * charSpacing;
            } catch {
              lineWidth = line.length * effectiveSize * 0.55 + (line.length - 1) * charSpacing;
            }

            let lineX = pdfX;
            if (span.textAlign === 'center') {
              lineX = pdfX + Math.max(0, (boxWidth - lineWidth) / 2);
            } else if (span.textAlign === 'right') {
              lineX = pdfX + Math.max(0, boxWidth - lineWidth);
            }

            if (charSpacing > 0 && line.length > 1) {
              let curCharX = lineX;
              for (let cIdx = 0; cIdx < line.length; cIdx++) {
                const ch = line[cIdx];
                page.drawText(ch, {
                  x: Math.max(0, curCharX),
                  y: Math.max(0, adjustedLineY),
                  size: effectiveSize,
                  font,
                  color,
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
                y: Math.max(0, adjustedLineY),
                size: effectiveSize,
                font,
                color,
              });
            }

            if (span.underline) {
              page.drawLine({
                start: { x: Math.max(0, lineX), y: Math.max(0, adjustedLineY - 2) },
                end: { x: Math.max(0, lineX + lineWidth), y: Math.max(0, adjustedLineY - 2) },
                thickness: Math.max(1, effectiveSize * 0.08),
                color,
              });
            }

            if (span.strikethrough) {
              page.drawLine({
                start: { x: Math.max(0, lineX), y: Math.max(0, adjustedLineY + effectiveSize * 0.35) },
                end: { x: Math.max(0, lineX + lineWidth), y: Math.max(0, adjustedLineY + effectiveSize * 0.35) },
                thickness: Math.max(1, effectiveSize * 0.08),
                color,
              });
            }
          });
        }
      }
    }

    if (!annotations || annotations.length === 0) {
      return await pdfDoc.save();
    }
    const pages = pdfDoc.getPages();

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
