import React from 'react';
import { ShieldCheck, Lock, HardDrive, Zap, Globe, FileText } from 'lucide-react';
import { NuvioLogo } from '../components/brand/NuvioLogo';

export const AboutPage: React.FC = () => {
  const principles = [
    {
      icon: <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      title: 'Privacy-First',
      description: 'Your documents belong to you. We do not track, inspect, or store your personal files.',
    },
    {
      icon: <HardDrive className="w-4 h-4 text-brand-600 dark:text-brand-400" />,
      title: 'Local-First Processing',
      description: 'All document modifications, conversions, and optical recognition run directly on your device.',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      title: 'No Unnecessary Uploads',
      description: 'Files remain in your browser session and are not uploaded to remote servers or third-party cloud storage.',
    },
    {
      icon: <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      title: 'Frictionless Workflows',
      description: 'Clean, focused tools designed for editing, organizing, and converting documents with zero latency.',
    },
    {
      icon: <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      title: 'Free to Use',
      description: 'Built as an open, accessible workstation with zero subscription fees, paywalls, or hidden tiers.',
    },
    {
      icon: <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
      title: 'Accessible Everywhere',
      description: 'Works instantly on desktop, laptop, tablet, and mobile browsers without requiring software installation.',
    },
  ];

  const workflows = [
    {
      title: 'PDF Editor',
      description: 'Directly edit existing text, insert new text, add signatures (draw, type, upload), apply stamps, draw shapes, and add watermarks with live autosave and continuous multi-page scrolling.',
    },
    {
      title: 'Document Conversion',
      description: 'Convert PDFs to Microsoft Word (.docx) preserving geometry, page orientation, text formatting, and tabular layout, or convert Word documents (.docx) to PDF.',
    },
    {
      title: 'PDF Organization & Tools',
      description: 'Merge multiple documents into one, split pages into distinct files, reorder and rotate pages, compress file size, add page numbers, and manage multi-page documents.',
    },
    {
      title: 'Image & Media Tools',
      description: 'Extract lossless PNG and high-resolution JPG images, compile image sets to PDF with custom margins, and compress media on-device.',
    },
  ];

  const dependencies = [
    { name: 'pdf-lib', license: 'MIT', purpose: 'PDF binary manipulation and annotation burning' },
    { name: 'pdfjs-dist', license: 'Apache-2.0', purpose: 'PDF page rendering and text layout parsing' },
    { name: 'docx', license: 'MIT', purpose: 'Word OpenXML (.docx) structured document generation' },
    { name: 'mammoth', license: 'BSD-2-Clause', purpose: 'Word (.docx) parsing and text extraction' },
    { name: 'tesseract.js', license: 'Apache-2.0', purpose: 'Text recognition for scanned documents' },
    { name: 'jszip', license: 'MIT', purpose: 'ZIP packaging for multi-file downloads' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <NuvioLogo variant="compact" size="md" />
        </div>
        <h1 className="text-3xl font-extrabold text-nuvio-ink dark:text-white tracking-tight">
          About NUVIO
        </h1>
        <p className="text-base font-medium text-brand-600 dark:text-brand-400 mt-1">
          Your documents. Done in seconds. Private document tools that run in your browser.
        </p>
        <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted mt-2 leading-relaxed">
          Nuvio is a next-generation browser-native document workstation designed to handle everyday PDF and document
          tasks quickly, privately, and reliably without requiring external cloud accounts or paid software.
        </p>
      </div>

      {/* Core Principles */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-nuvio-ink dark:text-white">
          Core Principles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {principles.map((p) => (
            <div
              key={p.title}
              className="p-4 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-1.5 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                {p.icon}
                <h3 className="text-xs font-bold text-nuvio-ink dark:text-white">{p.title}</h3>
              </div>
              <p className="text-[11px] text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Workflows */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-nuvio-ink dark:text-white">
          Supported Document Workflows
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workflows.map((w) => (
            <div
              key={w.title}
              className="p-4 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-1.5 shadow-2xs"
            >
              <h3 className="text-xs font-bold text-nuvio-ink dark:text-white">{w.title}</h3>
              <p className="text-[11px] text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                {w.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Open Source / Permissive Licensing */}
      <section id="licenses" className="p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-slate-50/50 dark:bg-nuvio-darkSurface/50 flex flex-col gap-3">
        <h2 className="text-xs font-bold text-nuvio-ink dark:text-white uppercase tracking-wider">
          Open-Source Foundations
        </h2>
        <p className="text-[11px] text-nuvio-muted leading-relaxed">
          Nuvio is built using permissively licensed open-source technologies for client-side document processing:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
          {dependencies.map((dep) => (
            <div key={dep.name} className="p-2.5 rounded-lg bg-white dark:bg-nuvio-darkSurface border border-nuvio-border dark:border-nuvio-darkBorder">
              <span className="font-semibold font-mono text-nuvio-ink dark:text-white block">{dep.name}</span>
              <span className="text-[10px] text-nuvio-muted font-mono block">{dep.license}</span>
              <span className="text-[10px] text-nuvio-muted mt-0.5 block">{dep.purpose}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
