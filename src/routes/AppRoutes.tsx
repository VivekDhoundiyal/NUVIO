import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Core Pages (Eagerly loaded for instant home experience)
import { Dashboard } from '../pages/Dashboard';
import { SettingsPage } from '../pages/SettingsPage';
import { AboutPage } from '../pages/AboutPage';
import { ContactPage } from '../pages/ContactPage';

// Lazy loaded feature tools for optimal bundle size and instant initial load
const PdfEditorPage = lazy(() =>
  import('../features/pdf-editor/PdfEditorPage').then((m) => ({ default: m.PdfEditorPage }))
);
const MergePdfPage = lazy(() =>
  import('../features/pdf-tools/MergePdfPage').then((m) => ({ default: m.MergePdfPage }))
);
const SplitPdfPage = lazy(() =>
  import('../features/pdf-tools/SplitPdfPage').then((m) => ({ default: m.SplitPdfPage }))
);
const OrganizePdfPage = lazy(() =>
  import('../features/pdf-tools/OrganizePdfPage').then((m) => ({ default: m.OrganizePdfPage }))
);
const CompressPdfPage = lazy(() =>
  import('../features/pdf-tools/CompressPdfPage').then((m) => ({ default: m.CompressPdfPage }))
);
const WatermarkPage = lazy(() =>
  import('../features/pdf-tools/WatermarkPage').then((m) => ({ default: m.WatermarkPage }))
);
const PageNumbersPage = lazy(() =>
  import('../features/pdf-tools/PageNumbersPage').then((m) => ({ default: m.PageNumbersPage }))
);

const SignPdfPage = lazy(() =>
  import('../features/pdf-tools/SignPdfPage').then((m) => ({ default: m.SignPdfPage }))
);
const RotatePdfPage = lazy(() =>
  import('../features/pdf-tools/RotatePdfPage').then((m) => ({ default: m.RotatePdfPage }))
);
const DeletePagesPage = lazy(() =>
  import('../features/pdf-tools/DeletePagesPage').then((m) => ({ default: m.DeletePagesPage }))
);
const ExtractPagesPage = lazy(() =>
  import('../features/pdf-tools/ExtractPagesPage').then((m) => ({ default: m.ExtractPagesPage }))
);
const ProtectPdfPage = lazy(() =>
  import('../features/pdf-tools/ProtectPdfPage').then((m) => ({ default: m.ProtectPdfPage }))
);
const UnlockPdfPage = lazy(() =>
  import('../features/pdf-tools/UnlockPdfPage').then((m) => ({ default: m.UnlockPdfPage }))
);
const RedactPdfPage = lazy(() =>
  import('../features/pdf-tools/RedactPdfPage').then((m) => ({ default: m.RedactPdfPage }))
);
const FillPdfPage = lazy(() =>
  import('../features/pdf-tools/FillPdfPage').then((m) => ({ default: m.FillPdfPage }))
);

const PdfToWordPage = lazy(() =>
  import('../features/conversion/PdfToWordPage').then((m) => ({ default: m.PdfToWordPage }))
);
const WordToPdfPage = lazy(() =>
  import('../features/conversion/WordToPdfPage').then((m) => ({ default: m.WordToPdfPage }))
);
const PdfToJpgPage = lazy(() =>
  import('../features/conversion/PdfToJpgPage').then((m) => ({ default: m.PdfToJpgPage }))
);
const JpgToPdfPage = lazy(() =>
  import('../features/conversion/JpgToPdfPage').then((m) => ({ default: m.JpgToPdfPage }))
);
const PdfToPngPage = lazy(() =>
  import('../features/conversion/PdfToPngPage').then((m) => ({ default: m.PdfToPngPage }))
);
const PngToPdfPage = lazy(() =>
  import('../features/conversion/PngToPdfPage').then((m) => ({ default: m.PngToPdfPage }))
);

const OcrPage = lazy(() =>
  import('../features/ocr/OcrPage').then((m) => ({ default: m.OcrPage }))
);

const ImagesToPdfPage = lazy(() =>
  import('../features/image-tools/ImagesToPdfPage').then((m) => ({ default: m.ImagesToPdfPage }))
);
const PdfToImagesPage = lazy(() =>
  import('../features/image-tools/PdfToImagesPage').then((m) => ({ default: m.PdfToImagesPage }))
);
const ImageOptimizerPage = lazy(() =>
  import('../features/image-tools/ImageOptimizerPage').then((m) => ({ default: m.ImageOptimizerPage }))
);

const TextToolsPage = lazy(() =>
  import('../features/productivity/TextToolsPage').then((m) => ({ default: m.TextToolsPage }))
);
const QrStudioPage = lazy(() =>
  import('../features/productivity/QrStudioPage').then((m) => ({ default: m.QrStudioPage }))
);

const GuideIndexPage = lazy(() =>
  import('../features/seo/guides/GuideIndexPage').then((m) => ({ default: m.GuideIndexPage }))
);
const GuideDetailPage = lazy(() =>
  import('../features/seo/guides/GuideDetailPage').then((m) => ({ default: m.GuideDetailPage }))
);

const InternalQaPage = lazy(() =>
  import('../pages/InternalQaPage').then((m) => ({ default: m.InternalQaPage }))
);

const LoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[50vh] gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    <span className="text-xs font-medium text-slate-500">Loading tool...</span>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        
        {/* Core PDF Editor (Canonical /edit-pdf and legacy /pdf-editor) */}
        <Route path="/edit-pdf" element={<PdfEditorPage />} />
        <Route path="/pdf-editor" element={<PdfEditorPage />} />
        
        {/* Conversion Tools */}
        <Route path="/pdf-to-word" element={<PdfToWordPage />} />
        <Route path="/word-to-pdf" element={<WordToPdfPage />} />
        <Route path="/pdf-to-jpg" element={<PdfToJpgPage />} />
        <Route path="/jpg-to-pdf" element={<JpgToPdfPage />} />
        <Route path="/pdf-to-png" element={<PdfToPngPage />} />
        <Route path="/png-to-pdf" element={<PngToPdfPage />} />

        {/* PDF Essentials */}
        <Route path="/merge-pdf" element={<MergePdfPage />} />
        <Route path="/split-pdf" element={<SplitPdfPage />} />
        <Route path="/organize-pdf" element={<OrganizePdfPage />} />
        <Route path="/rotate-pdf" element={<RotatePdfPage />} />
        <Route path="/delete-pdf-pages" element={<DeletePagesPage />} />
        <Route path="/extract-pdf-pages" element={<ExtractPagesPage />} />
        <Route path="/compress-pdf" element={<CompressPdfPage />} />
        
        {/* Edit, Sign & Security */}
        <Route path="/sign-pdf" element={<SignPdfPage />} />
        <Route path="/watermark-pdf" element={<WatermarkPage />} />
        <Route path="/page-numbers" element={<PageNumbersPage />} />
        <Route path="/protect-pdf" element={<ProtectPdfPage />} />
        <Route path="/unlock-pdf" element={<UnlockPdfPage />} />
        <Route path="/redact-pdf" element={<RedactPdfPage />} />
        <Route path="/fill-pdf" element={<FillPdfPage />} />

        {/* OCR & Text */}
        <Route path="/ocr" element={<OcrPage />} />
        <Route path="/ocr-pdf" element={<OcrPage />} />

        {/* Image & Media Tools */}
        <Route path="/images-to-pdf" element={<ImagesToPdfPage />} />
        <Route path="/pdf-to-images" element={<PdfToImagesPage />} />
        <Route path="/image-optimizer" element={<ImageOptimizerPage />} />

        {/* Productivity Utilities */}
        <Route path="/text-tools" element={<TextToolsPage />} />
        <Route path="/qr-studio" element={<QrStudioPage />} />

        {/* Internal Developer QA Console */}
        <Route path="/qa" element={<InternalQaPage />} />

        {/* SEO Knowledge Base & Guides */}
        <Route path="/guides" element={<GuideIndexPage />} />
        <Route path="/guides/:slug" element={<GuideDetailPage />} />

        {/* Informational Pages */}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
