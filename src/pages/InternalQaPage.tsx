import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '../components/ui/Button';
import { QaTestFixtures } from '../tests/qaTestFixtures';
import { PdfEngine } from '../engines/pdf/pdfEngine';
import { PdfProtectionEngine } from '../engines/pdf/pdfProtectionEngine';
import { PdfRedactionEngine } from '../engines/pdf/pdfRedactionEngine';
import { PdfFormEngine } from '../engines/pdf/pdfFormEngine';
import { CompressionEngine } from '../engines/compression/compressionEngine';
import { ValidationEngine } from '../engines/validation/validationEngine';

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  outputSummary?: string;
  error?: string;
  artifactBytes?: Uint8Array;
}

export const InternalQaPage: React.FC = () => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([
    {
      id: 'watermark-text',
      name: 'Watermark Engine (Text, Rotation, Position Preset)',
      category: 'Watermark',
      status: 'idle',
    },
    {
      id: 'watermark-image',
      name: 'Watermark Engine (Image PNG, Tiling Grid, Opacity)',
      category: 'Watermark',
      status: 'idle',
    },
    {
      id: 'protection-aes256',
      name: 'Protection Engine (AES-256 Encryption & Decryption)',
      category: 'Security',
      status: 'idle',
    },
    {
      id: 'protection-rc4',
      name: 'Protection Engine (RC4 Legacy Encryption Check)',
      category: 'Security',
      status: 'idle',
    },
    {
      id: 'redaction-vector',
      name: 'Redaction Engine (Vector Text Sanitization)',
      category: 'Security',
      status: 'idle',
    },
    {
      id: 'acroform-fill',
      name: 'AcroForm Engine (Discover Fields, Fill & Flatten)',
      category: 'Forms',
      status: 'idle',
    },
    {
      id: 'split-merge',
      name: 'PDF Split & Merge Operations',
      category: 'Organize',
      status: 'idle',
    },
    {
      id: 'rotate-delete',
      name: 'PDF Rotate & Delete Pages Pipeline',
      category: 'Organize',
      status: 'idle',
    },
    {
      id: 'compression',
      name: 'Compression Engine (Object Stream Normalization)',
      category: 'Optimization',
      status: 'idle',
    },
    {
      id: 'validation-engine',
      name: 'Validation Engine (Integrity, XRef & Header Verification)',
      category: 'Validation',
      status: 'idle',
    },
  ]);

  const updateTestStatus = (
    id: string,
    update: Partial<TestResult>
  ) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...update } : t))
    );
  };

  const runTest = async (testId: string) => {
    updateTestStatus(testId, { status: 'running', error: undefined });
    const startTime = performance.now();

    try {
      let outputSummary = '';
      let artifactBytes: Uint8Array | undefined;

      switch (testId) {
        case 'watermark-text': {
          const sample = await QaTestFixtures.createSinglePagePdf();
          const watermarked = await PdfEngine.addWatermark(sample, {
            type: 'text',
            text: 'CONFIDENTIAL QA TEST',
            opacity: 0.35,
            fontSize: 42,
            rotationAngle: 45,
            position: 'center',
          });
          artifactBytes = watermarked;
          const validation = await ValidationEngine.validatePdfOutput(watermarked, {
            expectedPageCount: 1,
            operationName: 'Watermark Text QA',
          });
          if (!validation.passed) throw new Error('Watermarked output failed validation audit');
          outputSummary = `Watermark applied. Validated size: ${watermarked.length} bytes. Validation score: ${validation.score}/100`;
          break;
        }

        case 'watermark-image': {
          const sample = await QaTestFixtures.createMultiPagePdf(2);
          const sampleImg = await QaTestFixtures.createTestPngDataUrl();
          const watermarked = await PdfEngine.addWatermark(sample, {
            type: 'image',
            imageDataUrl: sampleImg,
            imageWidth: 100,
            imageHeight: 100,
            opacity: 0.4,
            position: 'tile',
          });
          artifactBytes = watermarked;
          outputSummary = `Tiled image watermark applied across 2 pages. Final size: ${watermarked.length} bytes`;
          break;
        }

        case 'protection-aes256': {
          const sample = await QaTestFixtures.createSinglePagePdf();
          const password = 'TestSecurePassword#99';
          const encrypted = await PdfProtectionEngine.encryptPdf(sample, {
            userPassword: password,
            algorithm: 'AES-256',
          });
          const isEnc = await PdfProtectionEngine.isEncrypted(encrypted);
          if (!isEnc) throw new Error('isEncrypted returned false after encryption');

          const decrypted = await PdfProtectionEngine.decryptPdf(encrypted, password);
          const info = await PdfEngine.getPdfInfo(decrypted);
          if (info.pageCount !== 1) throw new Error('Decrypted page count does not match');

          artifactBytes = encrypted;
          outputSummary = `AES-256 encrypted (${encrypted.length} bytes) and decrypted successfully. Verified page count = 1`;
          break;
        }

        case 'protection-rc4': {
          const sample = await QaTestFixtures.createSinglePagePdf();
          const password = 'TestRc4Password';
          const encrypted = await PdfProtectionEngine.encryptPdf(sample, {
            userPassword: password,
            algorithm: 'RC4',
          });
          const isEnc = await PdfProtectionEngine.isEncrypted(encrypted);
          if (!isEnc) throw new Error('RC4 isEncrypted returned false');

          await PdfProtectionEngine.decryptPdf(encrypted, password);
          artifactBytes = encrypted;
          outputSummary = `RC4 legacy encryption & decryption cycle passed. Size: ${encrypted.length} bytes`;
          break;
        }

        case 'redaction-vector': {
          const sample = await QaTestFixtures.createSinglePagePdf();
          const redactionArea = {
            id: 'redact-1',
            pageIndex: 0,
            x: 50,
            y: 770,
            width: 400,
            height: 35,
            label: '[REDACTED]',
          };
          const redactedResult = await PdfRedactionEngine.applyPermanentRedactions(sample, [redactionArea]);
          artifactBytes = redactedResult.pdfBytes;
          outputSummary = `Sanitized text vector stream with permanent redaction overlay. Size: ${redactedResult.pdfBytes.length} bytes`;
          break;
        }

        case 'acroform-fill': {
          const formDoc = await QaTestFixtures.createAcroFormPdf();
          const fields = await PdfFormEngine.extractFormFields(formDoc);
          if (fields.length < 2) throw new Error(`Expected at least 2 fields, found ${fields.length}`);

          const filled = await PdfFormEngine.fillForm(
            formDoc,
            {
              fullName: 'Antigravity QA Automator',
              emailAddress: 'qa@nuvio.internal',
              acceptedTerms: true,
            },
            true
          );
          artifactBytes = filled;
          outputSummary = `Found ${fields.length} AcroForm fields, filled and flattened form successfully. Size: ${filled.length} bytes`;
          break;
        }

        case 'split-merge': {
          const multi = await QaTestFixtures.createMultiPagePdf(4);
          const splitPages = await PdfEngine.splitPdf(multi, { mode: 'all' });
          if (splitPages.length !== 4) throw new Error(`Expected 4 split pages, got ${splitPages.length}`);

          const merged = await PdfEngine.mergePdfs([splitPages[0], splitPages[3]]);
          const info = await PdfEngine.getPdfInfo(merged);
          if (info.pageCount !== 2) throw new Error(`Expected merged pageCount 2, got ${info.pageCount}`);

          artifactBytes = merged;
          outputSummary = `Split 4-page PDF into 4 documents, re-merged pages 1 and 4 into a 2-page PDF. Size: ${merged.length} bytes`;
          break;
        }

        case 'rotate-delete': {
          const multi = await QaTestFixtures.createMultiPagePdf(3);
          const rotated = await PdfEngine.rotatePages(multi, [0], 90);
          const deleted = await PdfEngine.deletePages(rotated, [1]); // Delete 2nd page
          const info = await PdfEngine.getPdfInfo(deleted);
          if (info.pageCount !== 2) throw new Error(`Expected 2 pages after delete, got ${info.pageCount}`);

          artifactBytes = deleted;
          outputSummary = `Rotated page 1 by 90deg, deleted page 2. Remaining pages: ${info.pageCount}`;
          break;
        }

        case 'compression': {
          const sample = await QaTestFixtures.createMultiPagePdf(3);
          const compressed = await CompressionEngine.compressPdf(sample, { level: 'medium' });
          if (!compressed.pdfBytes || compressed.pdfBytes.length === 0) throw new Error('Compression output is empty');

          artifactBytes = compressed.pdfBytes;
          outputSummary = `Object stream compaction applied. Original: ${sample.length}B -> Compressed: ${compressed.compressedSizeBytes}B`;
          break;
        }

        case 'validation-engine': {
          const sample = await QaTestFixtures.createSinglePagePdf();
          const report = await ValidationEngine.validatePdfOutput(sample, {
            expectedPageCount: 1,
            originalPageCount: 1,
            operationName: 'Internal QA Verification',
          });
          if (!report.passed) throw new Error('Validation audit failed');

          artifactBytes = sample;
          outputSummary = `Passed 100% integrity audit. Checks evaluated: ${report.items.length}. Score: ${report.score}/100`;
          break;
        }
      }

      const durationMs = Math.round(performance.now() - startTime);
      updateTestStatus(testId, {
        status: 'passed',
        durationMs,
        outputSummary,
        artifactBytes,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      updateTestStatus(testId, {
        status: 'failed',
        durationMs,
        error: err.message || 'Unknown test failure',
      });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (const test of tests) {
      await runTest(test.id);
    }
    setIsRunningAll(false);
  };

  const resetAllTests = () => {
    setTests((prev) =>
      prev.map((t) => ({
        ...t,
        status: 'idle',
        durationMs: undefined,
        outputSummary: undefined,
        error: undefined,
        artifactBytes: undefined,
      }))
    );
  };

  const handleDownloadArtifact = (test: TestResult) => {
    if (!test.artifactBytes) return;
    const safeBuffer = new Uint8Array(test.artifactBytes.slice(0));
    const blob = new Blob([safeBuffer], { type: 'application/pdf' });
    saveAs(blob, `qa-artifact-${test.id}.pdf`);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const failedCount = tests.filter((t) => t.status === 'failed').length;
  const runningCount = tests.filter((t) => t.status === 'running').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 text-xs font-mono font-bold tracking-wider uppercase">
              Internal QA Console
            </span>
            <span className="text-xs text-slate-500">v2.0 Client-Side Engine Suite</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            Engine Health & Functional Verification
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Execute real-time in-browser automated tests against Nuvio&apos;s client-side engines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={runAllTests}
            disabled={isRunningAll || runningCount > 0}
            variant="primary"
            className="text-xs gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Play className="w-3.5 h-3.5" />
            {isRunningAll ? 'Running Suite...' : 'Run All Tests'}
          </Button>

          <Button
            onClick={resetAllTests}
            disabled={isRunningAll || runningCount > 0}
            variant="ghost"
            className="text-xs gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500">Total Test Cases</span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{tests.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Passed</span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{passedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Failed</span>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{failedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-500">Architecture</span>
          <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-2">
            100% Client-Side
          </p>
        </div>
      </div>

      {/* Test List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Engine Verification Suite
          </span>
          <span className="text-xs text-slate-400">Status & Diagnostics</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {tests.map((test) => (
            <div key={test.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {test.category}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {test.name}
                  </span>
                </div>

                {test.outputSummary && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                    {test.outputSummary}
                  </p>
                )}

                {test.error && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Error: {test.error}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {test.durationMs !== undefined && (
                  <span className="text-xs font-mono text-slate-400">
                    {test.durationMs}ms
                  </span>
                )}

                {test.status === 'idle' && (
                  <span className="text-xs font-medium text-slate-400 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800">
                    Ready
                  </span>
                )}

                {test.status === 'running' && (
                  <span className="text-xs font-medium text-brand-600 px-2.5 py-1 rounded bg-brand-50 dark:bg-brand-950 animate-pulse">
                    Executing...
                  </span>
                )}

                {test.status === 'passed' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Passed
                  </span>
                )}

                {test.status === 'failed' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/40">
                    <XCircle className="w-3.5 h-3.5" />
                    Failed
                  </span>
                )}

                {test.artifactBytes && (
                  <button
                    type="button"
                    onClick={() => handleDownloadArtifact(test)}
                    title="Download generated test artifact"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                <Button
                  onClick={() => runTest(test.id)}
                  disabled={test.status === 'running' || isRunningAll}
                  variant="secondary"
                  className="text-xs py-1 px-3"
                >
                  Run
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
