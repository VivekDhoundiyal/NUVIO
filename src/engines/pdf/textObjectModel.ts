import type { EditableTextSpan, TextWordItem, PDFTextStyle, PDFTextGeometry } from '../../types/document';
import { PDFTextMetrics } from './pdfTextMetrics';

export class TextObjectModel {
  /**
   * Measures character width profile across a string using authoritative PDFTextMetrics.
   */
  static measureCharacterAdvances(
    text: string,
    totalSpanWidth: number,
    fontSize: number,
    fontFamily?: string
  ): number[] {
    if (!text || text.length === 0) return [];
    if (text.length === 1) return [totalSpanWidth];

    const measurement = PDFTextMetrics.measureText(text, { fontFamily, fontSize });
    const advances = measurement.glyphAdvances;

    if (advances.length === text.length) {
      // Normalize to extracted span width if span width is defined and valid
      const sum = advances.reduce((a, b) => a + b, 0);
      if (sum > 0 && totalSpanWidth > 0 && Math.abs(sum - totalSpanWidth) > 0.5) {
        const scale = totalSpanWidth / sum;
        return advances.map((a) => a * scale);
      }
      return advances;
    }

    // Uniform fallback if necessary
    const uniform = totalSpanWidth / text.length;
    return new Array(text.length).fill(uniform);
  }

  /**
   * Deconstructs an EditableTextSpan into discrete, hit-testable, and micro-editable TextWordItems.
   * Guarantees exact baseline preservation, non-reflowing spatial anchors, and immutable originalStyle.
   */
  static tokenizeSpanIntoWords(span: EditableTextSpan, pageHeight: number): TextWordItem[] {
    const text = span.currentText || span.originalText || '';
    if (!text.trim()) return [];

    const charAdvances = this.measureCharacterAdvances(text, span.width, span.fontSize, span.fontFamily);
    const words: TextWordItem[] = [];

    let currentWordChars: string[] = [];
    let currentWordStartIndex = -1;
    let currentWordX = 0;
    let runningX = 0;

    const charOffsets: number[] = new Array(text.length);
    for (let i = 0; i < text.length; i++) {
      charOffsets[i] = runningX;
      runningX += charAdvances[i] || (span.fontSize * 0.5);
    }

    const spanStyle: PDFTextStyle = span.originalStyle || {
      fontFamily: span.fontFamily || 'Helvetica, Arial, sans-serif',
      fontSize: span.fontSize,
      fontWeight: span.fontWeight || 'normal',
      fontStyle: span.fontStyle || 'normal',
      color: span.color || '#000000',
      rgbColor: span.rgbColor || { r: 0, g: 0, b: 0 },
      backgroundColor: span.backgroundColor,
      textAlign: span.textAlign || 'left',
      verticalAlign: span.verticalAlign || 'baseline',
      letterSpacing: span.letterSpacing || 0,
      lineHeight: span.lineHeight,
      pdfFontName: span.pdfFontName,
      fontResourceName: span.fontResourceName,
    };

    const spanSource = span.source || 'pdf-existing';

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const isWhitespace = /\s/.test(ch);

      if (!isWhitespace) {
        if (currentWordStartIndex === -1) {
          currentWordStartIndex = i;
          currentWordX = charOffsets[i];
          currentWordChars = [ch];
        } else {
          currentWordChars.push(ch);
        }
      } else {
        // Word boundary encountered
        if (currentWordStartIndex !== -1) {
          const wordText = currentWordChars.join('');
          // Authoritative word width measured using PDFTextMetrics
          const wordMeasurement = PDFTextMetrics.measureText(wordText, spanStyle);
          const wordWidth = Math.max(8, wordMeasurement.advanceWidth);
          const wordAbsoluteX = span.x + currentWordX;
          const wordAbsoluteY = span.y;
          const wordPdfY = span.baseline ?? (pageHeight - span.y - span.fontSize);

          // Build character bounds
          const charBounds: { char: string; x: number; width: number }[] = [];
          for (let cIdx = currentWordStartIndex; cIdx < i; cIdx++) {
            charBounds.push({
              char: text[cIdx],
              x: span.x + charOffsets[cIdx],
              width: charAdvances[cIdx],
            });
          }

          const wordGeom: PDFTextGeometry = {
            x: Math.round(wordAbsoluteX * 10) / 10,
            y: Math.round(wordAbsoluteY * 10) / 10,
            pdfX: Math.round(wordAbsoluteX * 10) / 10,
            pdfY: Math.round(wordPdfY * 10) / 10,
            width: Math.round(wordWidth * 10) / 10,
            height: Math.round(span.height * 10) / 10,
            baseline: wordPdfY,
            rotation: span.rotation || 0,
            textMatrix: span.rawTextMatrix,
          };

          words.push({
            id: `${span.id}-w${words.length}`,
            spanId: span.id,
            pageIndex: span.pageIndex,
            text: wordText,
            originalText: wordText,
            x: wordGeom.x,
            y: wordGeom.y,
            pdfX: wordGeom.pdfX,
            pdfY: wordGeom.pdfY,
            width: wordGeom.width,
            height: wordGeom.height,
            baseline: wordPdfY,
            fontSize: span.fontSize,
            fontFamily: span.fontFamily || 'Helvetica, Arial, sans-serif',
            pdfFontName: span.pdfFontName,
            fontWeight: span.fontWeight || 'normal',
            fontStyle: span.fontStyle || 'normal',
            color: span.color || '#000000',
            rgbColor: span.rgbColor || { r: 0, g: 0, b: 0 },
            streamIndex: span.streamIndex,
            opIndex: span.opIndex,
            fontResourceName: span.fontResourceName,
            rawTextMatrix: span.rawTextMatrix,
            rawOperandType: span.rawOperandType,
            isModified: false,
            dirty: false,
            source: spanSource,
            originalStyle: { ...spanStyle },
            currentStyle: { ...spanStyle },
            originalGeometry: { ...wordGeom },
            currentGeometry: { ...wordGeom },
            charBounds,
          });

          currentWordStartIndex = -1;
          currentWordChars = [];
        }
      }
    }

    // Flush any trailing word
    if (currentWordStartIndex !== -1) {
      const wordText = currentWordChars.join('');
      const wordMeasurement = PDFTextMetrics.measureText(wordText, spanStyle);
      const wordWidth = Math.max(8, wordMeasurement.advanceWidth);
      const wordAbsoluteX = span.x + currentWordX;
      const wordAbsoluteY = span.y;
      const wordPdfY = span.baseline ?? (pageHeight - span.y - span.fontSize);

      const charBounds: { char: string; x: number; width: number }[] = [];
      for (let cIdx = currentWordStartIndex; cIdx < text.length; cIdx++) {
        charBounds.push({
          char: text[cIdx],
          x: span.x + charOffsets[cIdx],
          width: charAdvances[cIdx],
        });
      }

      const wordGeom: PDFTextGeometry = {
        x: Math.round(wordAbsoluteX * 10) / 10,
        y: Math.round(wordAbsoluteY * 10) / 10,
        pdfX: Math.round(wordAbsoluteX * 10) / 10,
        pdfY: Math.round(wordPdfY * 10) / 10,
        width: Math.round(wordWidth * 10) / 10,
        height: Math.round(span.height * 10) / 10,
        baseline: wordPdfY,
        rotation: span.rotation || 0,
        textMatrix: span.rawTextMatrix,
      };

      words.push({
        id: `${span.id}-w${words.length}`,
        spanId: span.id,
        pageIndex: span.pageIndex,
        text: wordText,
        originalText: wordText,
        x: wordGeom.x,
        y: wordGeom.y,
        pdfX: wordGeom.pdfX,
        pdfY: wordGeom.pdfY,
        width: wordGeom.width,
        height: wordGeom.height,
        baseline: wordPdfY,
        fontSize: span.fontSize,
        fontFamily: span.fontFamily || 'Helvetica, Arial, sans-serif',
        pdfFontName: span.pdfFontName,
        fontWeight: span.fontWeight || 'normal',
        fontStyle: span.fontStyle || 'normal',
        color: span.color || '#000000',
        rgbColor: span.rgbColor || { r: 0, g: 0, b: 0 },
        streamIndex: span.streamIndex,
        opIndex: span.opIndex,
        fontResourceName: span.fontResourceName,
        rawTextMatrix: span.rawTextMatrix,
        rawOperandType: span.rawOperandType,
        isModified: false,
        dirty: false,
        source: spanSource,
        originalStyle: { ...spanStyle },
        currentStyle: { ...spanStyle },
        originalGeometry: { ...wordGeom },
        currentGeometry: { ...wordGeom },
        charBounds,
      });
    }

    return words;
  }

  /**
   * Spatial hit-testing: finds the exact word clicked on the page.
   */
  static hitTestWord(
    words: TextWordItem[],
    screenX: number,
    screenY: number,
    zoom: number,
    hitPadding: number = 2
  ): { word: TextWordItem; charIndex: number } | null {
    for (const word of words) {
      const wLeft = word.x * zoom - hitPadding;
      const wTop = word.y * zoom - hitPadding;
      const wRight = (word.x + word.width) * zoom + hitPadding;
      const wBottom = (word.y + word.height) * zoom + hitPadding;

      if (screenX >= wLeft && screenX <= wRight && screenY >= wTop && screenY <= wBottom) {
        // Resolve closest character index
        let charIndex = 0;
        if (word.charBounds && word.charBounds.length > 0) {
          for (let i = 0; i < word.charBounds.length; i++) {
            const cb = word.charBounds[i];
            const cbMid = (cb.x + cb.width / 2) * zoom;
            if (screenX >= cbMid) {
              charIndex = i + 1;
            }
          }
        } else {
          const ratio = Math.max(0, Math.min(1, (screenX - word.x * zoom) / (word.width * zoom)));
          charIndex = Math.round(ratio * word.text.length);
        }
        return { word, charIndex };
      }
    }
    return null;
  }

  /**
   * Updates an edited word inside a span with ZERO reflow of surrounding words.
   * Uses authoritative PDFTextMetrics to accurately measure the new text, eliminating
   * character clipping (including 'k', 'K', 'l', etc.).
   */
  static updateWordInSpan(
    span: EditableTextSpan,
    wordId: string,
    newWordText: string
  ): EditableTextSpan {
    if (!span.words || span.words.length === 0) {
      const measurement = PDFTextMetrics.measureText(newWordText, span.originalStyle || span);
      return {
        ...span,
        currentText: newWordText,
        width: Math.max(span.width, measurement.advanceWidth),
        isModified: true,
        dirty: true,
      };
    }

    const updatedWords = span.words.map((w) => {
      if (w.id === wordId) {
        const isModified = newWordText !== w.originalText;
        // Compute exact new width using authoritative PDFTextMetrics
        const measurement = PDFTextMetrics.measureText(newWordText, {
          fontFamily: w.fontFamily,
          fontSize: w.fontSize,
          fontWeight: w.fontWeight,
          fontStyle: w.fontStyle,
          letterSpacing: span.letterSpacing || 0,
        });
        const newWidth = Math.max(8, measurement.advanceWidth);

        const currentGeometry: PDFTextGeometry = {
          ...(w.currentGeometry || {
            x: w.x,
            y: w.y,
            pdfX: w.pdfX,
            pdfY: w.pdfY,
            width: w.width,
            height: w.height,
            baseline: w.baseline,
          }),
          width: newWidth,
        };

        return {
          ...w,
          text: newWordText,
          width: newWidth,
          isModified,
          dirty: isModified,
          currentGeometry,
        };
      }
      // CRITICAL: Surrounding words retain their exact untouched coordinates! Zero reflow!
      return w;
    });

    const anyWordModified = updatedWords.some((w) => w.isModified);

    // Reconstruct full span string preserving original spacing
    const origParts = (span.originalText || '').split(/(\s+)/);
    let wordIdx = 0;
    const reconstructedParts: string[] = [];

    for (const part of origParts) {
      if (!part) continue;
      if (/\s+/.test(part)) {
        reconstructedParts.push(part);
      } else {
        if (wordIdx < updatedWords.length) {
          reconstructedParts.push(updatedWords[wordIdx].text);
          wordIdx++;
        } else {
          reconstructedParts.push(part);
        }
      }
    }

    const reconstructedText = reconstructedParts.join('');

    // Re-measure full span width
    const spanMeasurement = PDFTextMetrics.measureText(reconstructedText, span.originalStyle || span);

    return {
      ...span,
      words: updatedWords,
      currentText: reconstructedText,
      width: Math.max(span.width, spanMeasurement.advanceWidth),
      isModified: anyWordModified,
      dirty: anyWordModified,
      currentGeometry: {
        ...(span.currentGeometry || {
          x: span.x,
          y: span.y,
          pdfX: span.pdfX || span.x,
          pdfY: span.pdfY || (span.baseline || 0),
          width: span.width,
          height: span.height,
          baseline: span.baseline || 0,
        }),
        width: Math.max(span.width, spanMeasurement.advanceWidth),
      },
    };
  }

  /**
   * Synchronizes span when currentText is edited directly (e.g., from PropertyPanel or span editing).
   * Tokenizes new words, preserves originalText mapping, and marks modified words.
   */
  static syncSpanText(
    span: EditableTextSpan,
    newText: string,
    pageHeight: number = 842
  ): EditableTextSpan {
    const isModified = newText !== span.originalText;
    const measurement = PDFTextMetrics.measureText(newText, span.originalStyle || span);

    const baseUpdated: EditableTextSpan = {
      ...span,
      currentText: newText,
      width: Math.max(span.width, measurement.advanceWidth),
      isModified,
      dirty: isModified,
      currentGeometry: {
        ...(span.currentGeometry || {
          x: span.x,
          y: span.y,
          pdfX: span.pdfX || span.x,
          pdfY: span.pdfY || (span.baseline || 0),
          width: span.width,
          height: span.height,
          baseline: span.baseline || 0,
        }),
        width: Math.max(span.width, measurement.advanceWidth),
      },
    };

    if (!span.words || span.words.length === 0) {
      return baseUpdated;
    }

    // Tokenize the new text into words
    const newWords = this.tokenizeSpanIntoWords(baseUpdated, pageHeight);

    // Reconcile with previous words to preserve originalText where possible
    for (let i = 0; i < newWords.length; i++) {
      const origWord = span.words[i];
      if (origWord) {
        newWords[i].originalText = origWord.originalText;
        newWords[i].originalStyle = origWord.originalStyle;
        newWords[i].originalGeometry = origWord.originalGeometry;
        newWords[i].isModified = newWords[i].text !== origWord.originalText;
        newWords[i].dirty = newWords[i].isModified;
      } else {
        newWords[i].isModified = true;
        newWords[i].dirty = true;
      }
    }

    return {
      ...baseUpdated,
      words: newWords,
    };
  }

  /**
   * Synchronizes typographic styles (fontFamily, fontSize, color, weight, style)
   * across all child words in the span when user explicitly updates formatting in the toolbar or panel.
   * Crucially preserves originalStyle and originalGeometry.
   */
  static syncSpanStyles(span: EditableTextSpan): EditableTextSpan {
    if (!span.words || span.words.length === 0) {
      return span;
    }
    const updatedWords = span.words.map((w) => {
      const newStyle: PDFTextStyle = {
        fontFamily: span.fontFamily || w.fontFamily,
        fontSize: span.fontSize,
        color: span.color || w.color,
        fontWeight: span.fontWeight || w.fontWeight,
        fontStyle: span.fontStyle || w.fontStyle,
        underline: span.underline,
        strikethrough: span.strikethrough,
        letterSpacing: span.letterSpacing,
      };

      const m = PDFTextMetrics.measureText(w.text, newStyle);

      return {
        ...w,
        fontSize: span.fontSize,
        fontFamily: newStyle.fontFamily,
        color: newStyle.color,
        fontWeight: (newStyle.fontWeight as any) || 'normal',
        fontStyle: (newStyle.fontStyle as any) || 'normal',
        width: m.advanceWidth,
        currentStyle: newStyle,
        currentGeometry: {
          ...(w.currentGeometry || {
            x: w.x,
            y: w.y,
            pdfX: w.pdfX,
            pdfY: w.pdfY,
            width: w.width,
            height: w.height,
            baseline: w.baseline,
          }),
          width: m.advanceWidth,
        },
      };
    });

    return {
      ...span,
      words: updatedWords,
    };
  }

  /**
   * Restores an edited span back to its original PDF text and style.
   */
  static revertSpan(span: EditableTextSpan): EditableTextSpan {
    const origStyle = span.originalStyle;
    const origGeom = span.originalGeometry;

    const revertedWords = (span.words || []).map((w) => ({
      ...w,
      text: w.originalText,
      fontFamily: w.originalStyle?.fontFamily || w.fontFamily,
      fontSize: w.originalStyle?.fontSize || w.fontSize,
      color: w.originalStyle?.color || w.color,
      fontWeight: (w.originalStyle?.fontWeight as any) || 'normal',
      fontStyle: (w.originalStyle?.fontStyle as any) || 'normal',
      width: w.originalGeometry?.width || w.width,
      isModified: false,
      dirty: false,
      currentStyle: w.originalStyle ? { ...w.originalStyle } : undefined,
      currentGeometry: w.originalGeometry ? { ...w.originalGeometry } : undefined,
    }));

    return {
      ...span,
      currentText: span.originalText,
      fontFamily: origStyle?.fontFamily || span.originalFontFamily || span.fontFamily,
      fontSize: origStyle?.fontSize || span.originalFontSize || span.fontSize,
      color: origStyle?.color || span.originalColor || span.color,
      fontWeight: (origStyle?.fontWeight as any) || 'normal',
      fontStyle: (origStyle?.fontStyle as any) || 'normal',
      width: origGeom?.width || span.width,
      height: origGeom?.height || span.height,
      underline: false,
      strikethrough: false,
      isModified: false,
      dirty: false,
      isDeleted: false,
      words: revertedWords,
      currentStyle: origStyle ? { ...origStyle } : undefined,
      currentGeometry: origGeom ? { ...origGeom } : undefined,
    };
  }
}
