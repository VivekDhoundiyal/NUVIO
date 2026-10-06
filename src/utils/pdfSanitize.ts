/**
 * WinAnsi / Latin-1 encoding sanitizer for standard PDF fonts (Helvetica, Times, Courier).
 * Replaces non-WinAnsi Unicode typography with safe equivalents to guarantee crash-proof PDF generation.
 */
export function sanitizeWinAnsiText(input: string): string {
  if (!input) return '';

  return input
    // Quotes & Apostrophes
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
    // Dashes & Hyphens
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    // Bullets & List markers
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '•')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Symbols
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00A9/g, '(C)')
    .replace(/\u00AE/g, '(R)')
    .replace(/[\u00A0\u2002\u2003\u2009]/g, ' ')
    // Replace any remaining unsupported characters (> 255) with ASCII approximations or ?
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\n\r\t]/g, (char) => {
      // Normalize decomposed characters e.g. accents
      const norm = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (norm.length === 1 && norm.charCodeAt(0) <= 255) return norm;
      return '?';
    });
}

/**
 * Toggles or applies bullet or numbered list formatting across lines of text.
 */
export function toggleListFormatting(text: string, listType: 'bullet' | 'number'): string {
  const lines = text.split('\n');
  const bulletPrefix = '• ';
  const numberRegex = /^\d+\.\s+/;
  const bulletRegex = /^•\s+/;

  // Determine if all non-empty lines already have the requested list prefix
  const allHaveTarget = lines.every((line) => {
    if (!line.trim()) return true;
    return listType === 'bullet' ? bulletRegex.test(line) : numberRegex.test(line);
  });

  if (allHaveTarget) {
    // Remove list prefixes
    return lines
      .map((line) => line.replace(bulletRegex, '').replace(numberRegex, ''))
      .join('\n');
  }

  // Apply list prefixes
  let numCounter = 1;
  return lines
    .map((line) => {
      if (!line.trim()) return line;
      // Strip any existing prefix first
      const clean = line.replace(bulletRegex, '').replace(numberRegex, '');
      if (listType === 'bullet') {
        return `${bulletPrefix}${clean}`;
      } else {
        const item = `${numCounter}. ${clean}`;
        numCounter++;
        return item;
      }
    })
    .join('\n');
}
