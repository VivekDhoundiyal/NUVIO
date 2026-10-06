import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Activity } from 'lucide-react';
import { NuvioLogo } from '../brand/NuvioLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkBg py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-nuvio-border/60 dark:border-nuvio-darkBorder/80">
          {/* Brand & Privacy Guarantee */}
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2">
              <NuvioLogo variant="full" size="md" showTagline={true} />
            </Link>
            <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
              Local-first document & PDF tools. Your documents. Done in seconds. The next-generation local document workstation executing directly inside your browser with zero cloud tracking, zero server uploads, and absolute confidentiality.
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>100% Client-Side • Zero Data Stored</span>
            </div>
          </div>

          {/* Popular PDF Tools */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-nuvio-ink dark:text-slate-200">
              Popular Tools
            </h4>
            <div className="flex flex-col gap-1.5 text-xs text-nuvio-muted dark:text-nuvio-darkMuted">
              <Link to="/edit-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                PDF Editor
              </Link>
              <Link to="/pdf-to-word" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                PDF to Word
              </Link>
              <Link to="/merge-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Merge PDF
              </Link>
              <Link to="/compress-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Compress PDF
              </Link>
              <Link to="/sign-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Sign PDF
              </Link>
              <Link to="/split-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Split PDF
              </Link>
            </div>
          </div>

          {/* Security & Conversion */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-nuvio-ink dark:text-slate-200">
              Security & Convert
            </h4>
            <div className="flex flex-col gap-1.5 text-xs text-nuvio-muted dark:text-nuvio-darkMuted">
              <Link to="/protect-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Protect PDF (AES-256)
              </Link>
              <Link to="/unlock-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Unlock PDF
              </Link>
              <Link to="/redact-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Redact PDF Permanently
              </Link>
              <Link to="/pdf-to-png" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                PDF to PNG (Lossless)
              </Link>
              <Link to="/png-to-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                PNG to PDF
              </Link>
              <Link to="/pdf-to-jpg" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                PDF to JPG
              </Link>
              <Link to="/ocr-pdf" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Local OCR & Text Extract
              </Link>
            </div>
          </div>

          {/* Knowledge, Guides & QA */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-nuvio-ink dark:text-slate-200">
              Guides & Platform
            </h4>
            <div className="flex flex-col gap-1.5 text-xs text-nuvio-muted dark:text-nuvio-darkMuted">
              <Link to="/guides" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                Knowledge Base & Tutorials
              </Link>
              <Link to="/guides/how-to-edit-pdf-without-adobe" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Edit PDF Without Adobe
              </Link>
              <Link to="/guides/how-to-protect-pdf-with-password" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Protect PDF Tutorial
              </Link>
              <Link to="/guides/how-to-redact-pdf-permanently" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Redact PDF Safely
              </Link>
              <Link to="/qa" className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline pt-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Internal QA Console</span>
              </Link>
              <Link to="/about" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                About Architecture
              </Link>
              <Link to="/contact" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Contact & Feedback
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-nuvio-muted dark:text-nuvio-darkMuted gap-3">
          <div className="flex items-center gap-1">
            <span>© {new Date().getFullYear()} NUVIO. All rights reserved. 100% Client-Side Privacy Architecture.</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/about#privacy" className="hover:underline">
              Privacy Guarantee
            </Link>
            <Link to="/about#licenses" className="hover:underline">
              Open Source Licenses
            </Link>
            <Link to="/settings" className="hover:underline">
              Preferences
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
