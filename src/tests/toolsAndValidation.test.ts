import { describe, it, expect } from 'vitest';
import * as Diff from 'diff';
import { searchTools, ALL_TOOLS } from '../registry/toolRegistry';
import { ValidationEngine } from '../engines/validation/validationEngine';

describe('Tool Registry & Search', () => {
  it('registers all required core tools', () => {
    expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(12);

    const toolIds = ALL_TOOLS.map((t) => t.id);
    expect(toolIds).toContain('pdf-editor');
    expect(toolIds).toContain('pdf-to-word');
    expect(toolIds).toContain('word-to-pdf');
    expect(toolIds).toContain('merge-pdf');
    expect(toolIds).toContain('split-pdf');
    expect(toolIds).toContain('compress-pdf');
    expect(toolIds).toContain('ocr-pdf');
  });

  it('resolves tool queries by aliases and keywords', () => {
    // "sign" should find PDF Editor
    const signResults = searchTools('sign');
    expect(signResults.some((t) => t.id === 'pdf-editor')).toBe(true);

    // "docx" should find PDF to Word and Word to PDF
    const docxResults = searchTools('docx');
    expect(docxResults.some((t) => t.id === 'pdf-to-word')).toBe(true);
    expect(docxResults.some((t) => t.id === 'word-to-pdf')).toBe(true);

    // "combine" should find merge
    const mergeResults = searchTools('combine');
    expect(mergeResults.some((t) => t.id === 'merge-pdf')).toBe(true);
  });
});

describe('ValidationEngine DOCX Audit', () => {
  it('correctly verifies standard OpenXML PK header', () => {
    // Mock valid PK\x03\x04 header
    const mockDocxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
    // Expand to > 1000 bytes
    const fullMock = new Uint8Array(2048);
    fullMock.set(mockDocxBytes, 0);

    const report = ValidationEngine.validateDocxOutput(fullMock, {
      originalPageCount: 1,
      originalSizeBytes: 1500,
    });

    expect(report.passed).toBe(true);
    expect(report.score).toBe(100);
    expect(report.items.some((i) => i.id === 'docx-magic-bytes' && i.status === 'passed')).toBe(true);
  });

  it('fails DOCX check on corrupted or missing PK header', () => {
    const invalidBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const report = ValidationEngine.validateDocxOutput(invalidBytes, {});

    expect(report.passed).toBe(false);
    expect(report.items.some((i) => i.id === 'docx-magic-bytes' && i.status === 'failed')).toBe(true);
  });
});

describe('Text Diff Logic', () => {
  it('accurately computes line differences', () => {
    const textA = 'Line 1\nLine 2\nLine 3';
    const textB = 'Line 1\nLine 2 modified\nLine 3';

    const diff = Diff.diffLines(textA, textB);
    expect(diff.some((d) => d.removed && d.value.includes('Line 2'))).toBe(true);
    expect(diff.some((d) => d.added && d.value.includes('modified'))).toBe(true);
  });
});
