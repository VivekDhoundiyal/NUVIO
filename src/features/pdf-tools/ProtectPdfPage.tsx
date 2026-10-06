import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Lock, Eye, EyeOff, RefreshCw, Key, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PdfEngine } from '../../engines/pdf/pdfEngine';
import { PdfProtectionEngine } from '../../engines/pdf/pdfProtectionEngine';
import { StorageService } from '../../services/storage/db';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const ProtectPdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [pageCount, setPageCount] = useState<number>(0);

  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [allowPrinting, setAllowPrinting] = useState<boolean>(true);
  const [allowCopying, setAllowCopying] = useState<boolean>(false);
  const [allowModifying, setAllowModifying] = useState<boolean>(false);
  const [allowFillingForms, setAllowFillingForms] = useState<boolean>(true);
  const [algorithm] = useState<'AES-256' | 'RC4'>('AES-256');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setPdfBytes(uint8);
      setFileName(file.name);

      const info = await PdfEngine.getPdfInfo(uint8, file.name);
      setPageCount(info.pages.length);

      await StorageService.logToolUsage('protect-pdf');
      toast.success('Document loaded', `${file.name} (${info.pages.length} pages ready to encrypt).`);
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', color: 'bg-slate-200', score: 0 };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', score: 25 };
    if (score === 2) return { label: 'Moderate', color: 'bg-amber-500', score: 50 };
    if (score === 3) return { label: 'Strong', color: 'bg-emerald-500', score: 75 };
    return { label: 'Very Strong', color: 'bg-emerald-600', score: 100 };
  };

  const handleProtectAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfBytes) return;

    if (!password || password.trim() === '') {
      toast.warning('Password required', 'Please enter a password to protect the document.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match', 'Please make sure both passwords match.');
      return;
    }

    setIsProcessing(true);

    try {
      const protectedBytes = await PdfProtectionEngine.protectPdf(pdfBytes, {
        userPassword: password,
        algorithm,
        allowPrinting,
        allowCopying,
        allowModifying,
        allowFillingForms,
      });

      const blob = new Blob([protectedBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-protected.pdf';
      saveAs(blob, finalName);

      toast.success('PDF Encrypted Successfully', `Saved ${finalName} with ${algorithm} encryption.`);
    } catch (err: any) {
      toast.error('Encryption failed', err.message || 'Could not encrypt PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Protect PDF with Password Online Free — Client-Side AES-256 Encryption"
        description="Password protect your PDF files with military-grade AES-256 encryption. Prevent unauthorized viewing, printing, and copying. 100% private in your browser."
        canonicalUrl="/protect-pdf"
        keywords={['protect pdf', 'password protect pdf', 'encrypt pdf', 'lock pdf', 'secure pdf online free']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Protect PDF',
          url: 'https://doculoom.com/protect-pdf',
          applicationCategory: 'SecurityApplication',
          operatingSystem: 'All',
        }}
      />

      {/* Header */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Protect PDF
            </h1>
          </div>
        </div>

        {pdfBytes && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              setPdfBytes(null);
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Change File
          </Button>
        )}
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-8">
        {!pdfBytes ? (
          <div className="max-w-xl mx-auto w-full py-12 flex flex-col items-center gap-6">
            <div className="text-center flex flex-col gap-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                Password Protect PDF Online
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Lock your confidential documents with military-grade AES-256 encryption directly inside your browser.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop PDF to Encrypt"
                description="Your document is encrypted locally without ever reaching a server."
              />
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6 py-6">
            <form
              onSubmit={handleProtectAndDownload}
              className="p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated flex flex-col gap-6"
            >
              {/* Document Overview */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{fileName}</h3>
                    <p className="text-xs text-slate-400">{pageCount} Pages • Ready to encrypt</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  AES-256 Bit
                </span>
              </div>

              {/* Password Fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Set Document Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a secure password"
                      required
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${strength.score}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              {/* Permissions & Security Options */}
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Granular Permissions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Allow Printing</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Allow Text Copying</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={allowFillingForms}
                      onChange={(e) => setAllowFillingForms(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Allow Form Filling</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => setAllowModifying(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Allow Modifying</span>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isProcessing}
                leftIcon={<Lock className="w-4 h-4" />}
                className="w-full mt-2"
              >
                Encrypt & Download Protected PDF
              </Button>
            </form>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Protect PDF"
          headline="Bank-Grade AES-256 PDF Password Protection"
          subheadline="Lock sensitive financial records, contracts, and legal papers with standard PDF encryption directly inside your browser."
          steps={[
            {
              title: 'Upload PDF Document',
              description: 'Select the file you want to secure. Your PDF never leaves your computer.',
            },
            {
              title: 'Set Password & Permissions',
              description: 'Create a password and optionally configure printing, copying, and editing restrictions.',
            },
            {
              title: 'Download Protected PDF',
              description: 'Save your encrypted file. Anyone opening the document will be required to input the password.',
            },
          ]}
          features={[
            {
              title: 'AES-256 Standard Encryption',
              description: 'Uses the highest security standard recognized by Adobe Acrobat and international PDF standards.',
            },
            {
              title: 'Zero Server Knowledge',
              description: 'Because encryption executes entirely on your device, no server or employee can ever see your passwords or documents.',
            },
            {
              title: 'Universal Compatibility',
              description: 'Protected PDFs open reliably in Adobe Acrobat, Apple Preview, Google Chrome, Microsoft Edge, and mobile viewers.',
            },
          ]}
          faqs={[
            {
              question: 'Can DocuLoom recover my password if I forget it?',
              answer: 'No. Because your document is encrypted locally with AES-256 bit cryptography, there is no backdoor or master recovery key. Keep your password safely stored.',
            },
            {
              question: 'Will this password prompt appear in Adobe Acrobat and phone apps?',
              answer: 'Yes. The encryption conforms strictly to the standard PDF Security Handler specification. All standard PDF readers will prompt for the password prior to displaying content.',
            },
            {
              question: 'Is client-side PDF encryption secure?',
              answer: 'Yes. Web Crypto API and modern cryptographic algorithms run the identical mathematical cipher operations locally that a server would perform, without the security risk of network transit.',
            },
          ]}
          relatedToolIds={['unlock-pdf', 'redact-pdf', 'sign-pdf', 'compress-pdf', 'pdf-editor']}
        />
      </main>
    </div>
  );
};
