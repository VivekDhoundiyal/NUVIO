import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Unlock, Eye, EyeOff, Download, RefreshCw, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PdfProtectionEngine } from '../../engines/pdf/pdfProtectionEngine';
import { StorageService } from '../../services/storage/db';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const UnlockPdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [unlockedBytes, setUnlockedBytes] = useState<Uint8Array | null>(null);

  const handleFileSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setPdfBytes(uint8);
      setFileName(file.name);
      setIsUnlocked(false);
      setUnlockedBytes(null);
      setPassword('');

      await StorageService.logToolUsage('unlock-pdf');
      toast.info('Document loaded', 'Enter the document password to remove protection.');
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfBytes) return;

    setIsProcessing(true);

    try {
      const decrypted = await PdfProtectionEngine.unlockPdf(pdfBytes, password);
      setUnlockedBytes(decrypted);
      setIsUnlocked(true);

      const blob = new Blob([decrypted as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-unlocked.pdf';
      saveAs(blob, finalName);

      toast.success('Document Unlocked', `Successfully removed password protection from ${finalName}.`);
    } catch (err: any) {
      toast.error('Unlock Failed', err.message || 'Incorrect password or corrupted file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Unlock PDF Online Free — Remove PDF Password Protection"
        description="Remove password protection and security restrictions from PDF files online. Free, fast, and 100% private in-browser decryption with zero server uploads."
        canonicalUrl="/unlock-pdf"
        keywords={['unlock pdf', 'remove pdf password', 'decrypt pdf', 'remove password from pdf', 'unlock pdf online free']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Unlock PDF',
          url: 'https://doculoom.com/unlock-pdf',
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
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              <Unlock className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Unlock PDF
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
              setIsUnlocked(false);
              setUnlockedBytes(null);
              setPassword('');
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
                Remove Password from PDF
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Permanently decrypt your protected PDF files. Client-side processing with complete data privacy.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop Password-Protected PDF"
                description="Decryption executes locally in your browser sandbox."
              />
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto w-full py-8">
            <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated flex flex-col gap-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[240px]">
                    {fileName}
                  </h3>
                  <p className="text-xs text-slate-400">Enter password to remove protection</p>
                </div>
              </div>

              {!isUnlocked ? (
                <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Document Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Type password to decrypt"
                        autoFocus
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
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isProcessing}
                    leftIcon={<Unlock className="w-4 h-4" />}
                    className="w-full mt-2"
                  >
                    Unlock & Download PDF
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Document Unlocked!
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Your unencrypted PDF has been generated and saved.
                    </p>
                  </div>

                  {unlockedBytes && (
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={<Download className="w-4 h-4" />}
                      onClick={() => {
                        const blob = new Blob([unlockedBytes as any], { type: 'application/pdf' });
                        saveAs(blob, fileName.replace(/\.pdf$/i, '') + '-unlocked.pdf');
                      }}
                      className="w-full"
                    >
                      Download Again
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Unlock PDF"
          headline="Remove Password and Open Encrypted PDF Documents"
          subheadline="DocuLoom strips password protection and viewing restrictions from your PDFs directly in the browser so you can view, print, copy, and share freely."
          steps={[
            {
              title: 'Upload Locked PDF',
              description: 'Select your password-protected PDF. The file stays safely on your device.',
            },
            {
              title: 'Provide Password',
              description: 'Type the document password to authorize local cryptographic decryption.',
            },
            {
              title: 'Download Unlocked File',
              description: 'Save your clean PDF. It will now open anywhere without ever asking for a password.',
            },
          ]}
          features={[
            {
              title: 'Permanent Password Removal',
              description: 'Removes the internal encryption dictionary so the document opens unrestricted on all devices.',
            },
            {
              title: 'Full Permission Restoration',
              description: 'Restores printing, copying, and modification capabilities on restricted documents.',
            },
            {
              title: 'Zero Cloud Transmission',
              description: 'Your sensitive passwords and private files are never transmitted to a server.',
            },
          ]}
          faqs={[
            {
              question: 'Do I need to know the original password to unlock the PDF?',
              answer: 'Yes. For legally compliant client-side decryption, you must know the password to authorize removing protection. DocuLoom does not perform brute-force password cracking.',
            },
            {
              question: 'Will the unlocked PDF work on mobile phones and e-readers?',
              answer: 'Yes. Once decrypted, the PDF conforms to standard unencrypted PDF specifications and opens seamlessly in all PDF readers without any password prompt.',
            },
            {
              question: 'Can I remove restrictions on printing or copying?',
              answer: 'Yes. Decrypting the PDF removes both the user open password and all owner permission restrictions.',
            },
          ]}
          relatedToolIds={['protect-pdf', 'redact-pdf', 'pdf-editor', 'compress-pdf', 'merge-pdf']}
        />
      </main>
    </div>
  );
};
