import {
  PDFDocument,
  PDFPage,
  PDFArray,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import { PdfContentParser, type StreamOperation, type Token } from './pdfContentParser';
import type { RunPatch } from './pdfTextEditEngine';

export class PdfContentStreamPatcher {
  /**
   * Decompresses all /Contents streams of a page into text strings.
   */
  public static getPageStreams(
    pdfDoc: PDFDocument,
    page: PDFPage
  ): { streamRefs: any[]; streamTexts: string[]; streamBytesList: Uint8Array[] } {
    const contentsRef = page.node.Contents();
    if (!contentsRef) {
      return { streamRefs: [], streamTexts: [], streamBytesList: [] };
    }

    const contentsObj = pdfDoc.context.lookup(contentsRef);
    if (!contentsObj) {
      return { streamRefs: [], streamTexts: [], streamBytesList: [] };
    }

    const streamRefs: any[] = [];
    if (contentsObj instanceof PDFArray) {
      for (let i = 0; i < contentsObj.size(); i++) {
        streamRefs.push(contentsObj.get(i));
      }
    } else {
      streamRefs.push(contentsRef);
    }

    const streamTexts: string[] = [];
    const streamBytesList: Uint8Array[] = [];

    for (const sRef of streamRefs) {
      const stream = pdfDoc.context.lookup(sRef);
      if (!stream) {
        streamTexts.push('');
        streamBytesList.push(new Uint8Array(0));
        continue;
      }

      let bytes: Uint8Array;
      try {
        if (stream instanceof PDFRawStream) {
          const decoded = decodePDFRawStream(stream);
          bytes = decoded ? decoded.decode() : stream.asUint8Array();
        } else if (typeof (stream as any).asUint8Array === 'function') {
          bytes = (stream as any).asUint8Array();
        } else {
          bytes = new Uint8Array(0);
        }
      } catch {
        bytes = (stream as any).asUint8Array?.() || new Uint8Array(0);
      }

      streamBytesList.push(bytes);
      streamTexts.push(new TextDecoder('latin1').decode(bytes));
    }

    return { streamRefs, streamTexts, streamBytesList };
  }

  /**
   * Applies surgical run patches to the content stream operations and serializes back.
   */
  public static patchStreamOperations(
    operations: StreamOperation[],
    patchesForStream: RunPatch[]
  ): string {
    const patchesByOp = new Map<number, RunPatch[]>();
    for (const p of patchesForStream) {
      const list = patchesByOp.get(p.opIndex) || [];
      list.push(p);
      patchesByOp.set(p.opIndex, list);
    }

    const outputLines: string[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const opPatches = patchesByOp.get(op.opIndex);

      if (!opPatches || opPatches.length === 0) {
        // Untouched operation: output exact original raw text
        outputLines.push(op.rawText);
        continue;
      }

      // Patched text operation
      if (op.operator === 'Tj' || op.operator === "'" || op.operator === '"') {
        outputLines.push(opPatches[0].patchedOperatorText);
      } else if (op.operator === 'TJ') {
        const arrayToken = op.operands[0];
        if (arrayToken && arrayToken.type === 'array') {
          const items = arrayToken.value as Token[];
          const modifiedItems: string[] = [];

          for (let arrIdx = 0; arrIdx < items.length; arrIdx++) {
            const patch = opPatches.find((p) => p.operandIndex === arrIdx);
            if (patch) {
              modifiedItems.push(patch.patchedOperatorText);
            } else {
              modifiedItems.push(items[arrIdx].raw);
            }
          }

          outputLines.push(`[ ${modifiedItems.join(' ')} ] TJ`);
        } else {
          outputLines.push(opPatches[0].patchedOperatorText);
        }
      } else {
        outputLines.push(opPatches[0].patchedOperatorText);
      }
    }

    return outputLines.join('\n');
  }

  /**
   * Applies patches to a page, recompresses the modified stream, and updates page /Contents.
   */
  public static async applyPatchesToPage(
    pdfDoc: PDFDocument,
    page: PDFPage,
    patches: RunPatch[]
  ): Promise<boolean> {
    if (patches.length === 0) return false;

    const { streamRefs, streamTexts } = this.getPageStreams(pdfDoc, page);
    if (streamRefs.length === 0) return false;

    const patchesByStream = new Map<number, RunPatch[]>();
    for (const p of patches) {
      const list = patchesByStream.get(p.streamIndex) || [];
      list.push(p);
      patchesByStream.set(p.streamIndex, list);
    }

    const contentsRef = page.node.Contents();
    const contentsObj = pdfDoc.context.lookup(contentsRef);

    let anyPatched = false;

    for (const [sIdx, streamPatches] of patchesByStream.entries()) {
      if (sIdx >= streamTexts.length) continue;

      const rawText = streamTexts[sIdx];
      const tokens = PdfContentParser.tokenize(rawText);
      const operations = PdfContentParser.parseOperations(tokens);

      const patchedStreamText = this.patchStreamOperations(operations, streamPatches);
      const newStreamBytes = new TextEncoder().encode(patchedStreamText);

      // Re-compress modified stream and register in context
      const newFlateStream = pdfDoc.context.flateStream(newStreamBytes);
      const newRef = pdfDoc.context.register(newFlateStream);

      if (contentsObj instanceof PDFArray) {
        contentsObj.set(sIdx, newRef);
      } else {
        page.node.set(PDFName.of('Contents'), newRef);
      }

      anyPatched = true;
    }

    return anyPatched;
  }
}
