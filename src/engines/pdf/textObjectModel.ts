import type { EditableTextSpan, TextWordItem } from '../../types/document';

/**
 * Typographic character width factor relative to font size (1em).
 * Used for accurate glyph bounds when canvas measurement is unavailable.
 */
const CHAR_WIDTH_RATIOS: Record<string, number> = {
  i: 0.28, l: 0.28, j: 0.28, t: 0.33, f: 0.33, r: 0.35,
  I: 0.33, J: 0.45,
  w: 0.72, m: 0.78, W: 0.88, M: 0.82,
  ' ': 0.28, '.': 0.28, ',': 0.28, ':': 0.28, ';': 0.28, '!': 0.28,
  '-': 0.35, '_': 0.5, '(': 0.33, ')': 0.33, '[': 0.33, ']': 0.33,
  '/': 0.33, '\\': 0.33, '"': 0.35, '\'': 0.22,
};

function getCharWidthRatio(char: string): number {
  if (CHAR_WIDTH_RATIOS[char] !== undefined) {
    return CHAR_WIDTH_RATIOS[char];
  }
  if (char >= 'A' && char <= 'Z') return 0.65;
  if (char >= '0' && char <= '9') return 0.55;
  return 0.52; // standard lowercase
}

export class TextObjectModel {
  /**
   * Measures character width profile across a string, normalized to the span's total width.
   */
  static measureCharacterAdvances(text: string, totalSpanWidth: number, fontSize: number): number[] {
    if (!text || text.length === 0) return [];
    if (text.length === 1) return [totalSpanWidth];

    // Compute raw estimated widths
    const rawWidths = new Array<number>(text.length);
    let rawTotal = 0;

    for (let i = 0; i < text.length; i++) {
      const w = getCharWidthRatio(text[i]) * fontSize;
      rawWidths[i] = w;
      rawTotal += w;
    }

    if (rawTotal <= 0) {
      const uniform = totalSpanWidth / text.length;
      return new Array(text.length).fill(uniform);
    }

    // Scale proportionally so the sum matches the exact span width extracted by PDF.js
    const scale = totalSpanWidth / rawTotal;
    return rawWidths.map((w) => w * scale);
  }

  /**
   * Deconstructs an EditableTextSpan into discrete, hit-testable, and micro-editable TextWordItems.
   */
  static tokenizeSpanIntoWords(span: EditableTextSpan, pageHeight: number): TextWordItem[] {
    const text = span.currentText || span.originalText || '';
    if (!text.trim()) return [];

    const charAdvances = this.measureCharacterAdvances(text, span.width, span.fontSize);
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
          const wordEndOffset = charOffsets[i];
          const wordWidth = Math.max(8, wordEndOffset - currentWordX);
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

          words.push({
            id: `${span.id}-w${words.length}`,
            spanId: span.id,
            pageIndex: span.pageIndex,
            text: wordText,
            originalText: wordText,
            x: Math.round(wordAbsoluteX * 10) / 10,
            y: Math.round(wordAbsoluteY * 10) / 10,
            pdfX: Math.round(wordAbsoluteX * 10) / 10,
            pdfY: Math.round(wordPdfY * 10) / 10,
            width: Math.round(wordWidth * 10) / 10,
            height: Math.round(span.height * 10) / 10,
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
      const wordEndOffset = runningX;
      const wordWidth = Math.max(8, wordEndOffset - currentWordX);
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

      words.push({
        id: `${span.id}-w${words.length}`,
        spanId: span.id,
        pageIndex: span.pageIndex,
        text: wordText,
        originalText: wordText,
        x: Math.round(wordAbsoluteX * 10) / 10,
        y: Math.round(wordAbsoluteY * 10) / 10,
        pdfX: Math.round(wordAbsoluteX * 10) / 10,
        pdfY: Math.round(wordPdfY * 10) / 10,
        width: Math.round(wordWidth * 10) / 10,
        height: Math.round(span.height * 10) / 10,
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
   * Updates an edited word inside a span and synchronizes the span's reconstructed text.
   */
  static updateWordInSpan(
    span: EditableTextSpan,
    wordId: string,
    newWordText: string
  ): EditableTextSpan {
    if (!span.words || span.words.length === 0) {
      return {
        ...span,
        currentText: newWordText,
        isModified: true,
      };
    }

    const updatedWords = span.words.map((w) => {
      if (w.id === wordId) {
        const isModified = newWordText !== w.originalText;
        // Compute estimated new width if changed
        const ratio = w.text.length > 0 ? newWordText.length / w.text.length : 1;
        const newWidth = Math.max(10, Math.round(w.width * ratio));
        return {
          ...w,
          text: newWordText,
          width: newWidth,
          isModified,
        };
      }
      return w;
    });

    const anyWordModified = updatedWords.some((w) => w.isModified);

    // Reconstruct full span string preserving spaces
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

    return {
      ...span,
      words: updatedWords,
      currentText: reconstructedText,
      isModified: anyWordModified,
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
    const baseUpdated: EditableTextSpan = {
      ...span,
      currentText: newText,
      isModified,
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
        newWords[i].isModified = newWords[i].text !== origWord.originalText;
      } else {
        newWords[i].isModified = true;
      }
    }

    return {
      ...baseUpdated,
      words: newWords,
    };
  }

  /**
   * Synchronizes typographic styles (fontFamily, fontSize, color, weight, style)
   * across all child words in the span.
   */
  static syncSpanStyles(span: EditableTextSpan): EditableTextSpan {
    if (!span.words || span.words.length === 0) {
      return span;
    }
    const updatedWords = span.words.map((w) => ({
      ...w,
      fontSize: span.fontSize,
      fontFamily: span.fontFamily || w.fontFamily,
      color: span.color || w.color,
      fontWeight: span.fontWeight || w.fontWeight,
      fontStyle: span.fontStyle || w.fontStyle,
    }));
    return {
      ...span,
      words: updatedWords,
    };
  }
}

