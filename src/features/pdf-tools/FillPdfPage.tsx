import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { FileCheck2, ArrowLeft, Download, RefreshCw, RotateCcw, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PdfFormEngine, type FormFieldInfo } from '../../engines/pdf/pdfFormEngine';
import { ValidationEngine } from '../../engines/validation/validationEngine';
import { StorageService } from '../../services/storage/db';

import { FileDropzone } from '../../components/ui/FileDropzone';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/useToast';
import { SEOHead } from '../seo/SEOHead';
import { ToolSEOContent } from '../seo/ToolSEOContent';

export const FillPdfPage: React.FC = () => {
  const toast = useToast();

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [flatten, setFlatten] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      setPdfBytes(uint8);
      setFileName(file.name);

      const extractedFields = await PdfFormEngine.extractFormFields(uint8);
      setFields(extractedFields);

      const initialValues: Record<string, any> = {};
      extractedFields.forEach((f) => {
        initialValues[f.name] = f.value;
      });
      setFormValues(initialValues);

      await StorageService.logToolUsage('fill-pdf');

      if (extractedFields.length > 0) {
        toast.success('Form detected', `Found ${extractedFields.length} interactive fields.`);
      } else {
        toast.info(
          'No AcroForm fields detected',
          'This PDF does not contain interactive form fields. You can use the PDF Editor to add text anywhere.'
        );
      }
    } catch (err: any) {
      toast.error('Failed to load PDF', err.message || 'File could not be parsed.');
    }
  };

  const handleInputChange = (name: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleResetForm = () => {
    const resetVals: Record<string, any> = {};
    fields.forEach((f) => {
      resetVals[f.name] = typeof f.value === 'boolean' ? false : '';
    });
    setFormValues(resetVals);
    toast.info('Form cleared', 'All field values reset.');
  };

  const handleDownloadFilledPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfBytes) return;

    setIsProcessing(true);

    try {
      const outputBytes = await PdfFormEngine.fillForm(pdfBytes, formValues, flatten);
      const report = await ValidationEngine.validatePdf(outputBytes);

      const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
      const finalName = fileName.replace(/\.pdf$/i, '') + '-filled.pdf';
      saveAs(blob, finalName);

      toast.success(
        'Form Exported Successfully',
        `Saved ${finalName} (${report.score}% fidelity score)${flatten ? ' [Flattened]' : ''}.`
      );
    } catch (err: any) {
      toast.error('Export failed', err.message || 'Error populating PDF form.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="Fill PDF Forms Online Free — Interactive AcroForm Filler"
        description="Fill out PDF forms online directly in your browser. Complete text fields, checkboxes, and dropdowns, then export or flatten. 100% private."
        canonicalUrl="/fill-pdf"
        keywords={['fill pdf', 'fill out pdf form', 'fill pdf online free', 'acroform filler', 'complete pdf form']}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'DocuLoom Fill PDF',
          url: 'https://doculoom.com/fill-pdf',
          applicationCategory: 'BusinessApplication',
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
            <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              Fill PDF Forms
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
              setFields([]);
              setFormValues({});
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
                Fill PDF Forms in Browser
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md">
                Interactive AcroForm filling with live input controls, form flattening, and zero cloud uploads.
              </p>
            </div>

            <div className="w-full">
              <FileDropzone
                accept=".pdf,application/pdf"
                onFilesSelected={handleFileSelected}
                title="Select or Drop Fillable PDF Form"
                description="Upload any interactive PDF to complete and download."
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 py-6">
            <form
              onSubmit={handleDownloadFilledPdf}
              className="p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-elevated flex flex-col gap-6"
            >
              {/* Document Overview */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{fileName}</h3>
                  <p className="text-xs text-slate-400">
                    {fields.length > 0
                      ? `${fields.length} Interactive Fields Detected`
                      : 'Non-interactive PDF document'}
                  </p>
                </div>
                {fields.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Values</span>
                  </button>
                )}
              </div>

              {/* No Fields Detected Callout */}
              {fields.length === 0 ? (
                <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col gap-3 text-amber-800 dark:text-amber-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>No AcroForm Interactive Fields Detected</span>
                  </div>
                  <p className="leading-relaxed">
                    This document appears to be a static scanned or flattened PDF rather than an AcroForm. You can use DocuLoom&apos;s full PDF Editor to add text, tick marks, and signatures anywhere on any page.
                  </p>
                  <div>
                    <Link to="/pdf-editor">
                      <Button variant="primary" size="sm">
                        Open in PDF Editor
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* Fields Input List */
                <div className="flex flex-col gap-4">
                  {fields.map((field) => (
                    <div
                      key={field.name}
                      className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30"
                    >
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {field.name}
                      </label>

                      {/* Text Input */}
                      {field.type === 'text' && (
                        field.isMultiline ? (
                          <textarea
                            rows={3}
                            value={formValues[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            disabled={field.isReadOnly}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formValues[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            disabled={field.isReadOnly}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        )
                      )}

                      {/* Checkbox */}
                      {field.type === 'checkbox' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!formValues[field.name]}
                            onChange={(e) => handleInputChange(field.name, e.target.checked)}
                            disabled={field.isReadOnly}
                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {field.name} (Checked)
                          </span>
                        </label>
                      )}

                      {/* Dropdown */}
                      {field.type === 'dropdown' && (
                        <select
                          value={formValues[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          disabled={field.isReadOnly}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">-- Select option --</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Radio Group */}
                      {field.type === 'radio' && (
                        <div className="flex flex-wrap items-center gap-4">
                          {field.options?.map((opt) => (
                            <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-xs">
                              <input
                                type="radio"
                                name={field.name}
                                value={opt}
                                checked={formValues[field.name] === opt}
                                onChange={() => handleInputChange(field.name, opt)}
                                disabled={field.isReadOnly}
                                className="text-brand-600 focus:ring-brand-500"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Flatten Form Toggle */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={flatten}
                        onChange={(e) => setFlatten(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-brand-600" />
                          Flatten Form (Read-Only)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Renders filled data permanently as page graphics so fields cannot be modified again.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Download Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isProcessing}
                    leftIcon={<Download className="w-4 h-4" />}
                    className="w-full mt-2"
                  >
                    Save & Download Filled Form
                  </Button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* SEO Information & Educational Content */}
        <ToolSEOContent
          toolName="Fill PDF Forms"
          headline="Fill Out Any PDF Form Quickly and Privately"
          subheadline="DocuLoom automatically detects AcroForm form fields in your PDFs and lets you enter text, select dropdowns, and tick checkboxes right in your browser."
          steps={[
            {
              title: 'Upload Fillable PDF',
              description: 'Select your tax form, application, or contract. DocuLoom identifies all interactive fields.',
            },
            {
              title: 'Fill Form Fields',
              description: 'Complete text fields, select options, and check boxes with clean, formatted entries.',
            },
            {
              title: 'Download Completed Form',
              description: 'Optionally flatten to lock the entries permanently, then save your filled document.',
            },
          ]}
          features={[
            {
              title: 'AcroForm Auto-Detection',
              description: 'Automatically detects text fields, multiline text areas, checkboxes, radio groups, and dropdowns.',
            },
            {
              title: 'Optional Form Flattening',
              description: 'Bake field entries permanently into the PDF page so nobody can alter your responses.',
            },
            {
              title: 'No Software Required',
              description: 'Works instantly on Windows, Mac, Linux, iPad, and Android without Adobe Acrobat installed.',
            },
          ]}
          faqs={[
            {
              question: 'What is form flattening and should I use it?',
              answer: 'Form flattening converts fillable interactive input boxes into static printed text and graphics. It is recommended when submitting completed tax returns, legal contracts, or official applications so the values cannot be accidentally changed by the recipient.',
            },
            {
              question: 'What if my PDF does not contain interactive fields?',
              answer: 'If your PDF is a flat scan or non-interactive document, you can use DocuLoom\'s free PDF Editor to place custom text boxes, check marks, and signatures anywhere on the document.',
            },
            {
              question: 'Are my completed form responses private?',
              answer: 'Yes. Form parsing, input population, and flattening execute 100% client-side inside your browser sandbox. Your personal information is never uploaded to any server.',
            },
          ]}
          relatedToolIds={['pdf-editor', 'sign-pdf', 'protect-pdf', 'compress-pdf', 'watermark-pdf']}
        />
      </main>
    </div>
  );
};
