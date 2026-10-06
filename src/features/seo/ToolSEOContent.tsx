import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ShieldCheck, Zap, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { ALL_TOOLS } from '../../registry/toolRegistry';

export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  title: string;
  description: string;
}

export interface ToolSEOContentProps {
  toolName: string;
  headline: string;
  subheadline: string;
  steps: HowToStep[];
  features: { title: string; description: string }[];
  faqs: FAQItem[];
  relatedToolIds: string[];
}

export const ToolSEOContent: React.FC<ToolSEOContentProps> = ({
  toolName,
  headline,
  subheadline,
  steps,
  features,
  faqs,
  relatedToolIds,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const relatedTools = relatedToolIds
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean);

  return (
    <article className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 flex flex-col gap-12 text-slate-800 dark:text-slate-200">
      {/* 1. Explanatory Header */}
      <section className="flex flex-col gap-3 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {headline}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {subheadline}
        </p>
      </section>

      {/* 2. Step-by-Step How To */}
      <section className="flex flex-col gap-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          How to use {toolName} in 3 Simple Steps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-subtle"
            >
              <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                {idx + 1}
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">
                {step.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Key Feature Cards */}
      <section className="flex flex-col gap-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Why Choose DocuLoom for {toolName}?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
              <Lock className="w-4 h-4" />
              <span>100% Client-Side Privacy</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Files are never transmitted across the network or uploaded to external servers. All operations execute inside your browser sandbox.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-brand-200 dark:border-brand-900/50 bg-brand-50/50 dark:bg-brand-950/20 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400 font-semibold text-xs">
              <Zap className="w-4 h-4" />
              <span>Instant Local Processing</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              No server queuing or download delays. WebAssembly and high-performance workers process documents immediately.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Document Object Preservation</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Untouched PDF objects, fonts, vectors, annotations, and spacing remain bit-for-bit identical without destructive normalization.
            </p>
          </div>

          {features.map((feat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-1.5 shadow-2xs"
            >
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span>{feat.title}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Frequently Asked Questions */}
      {faqs && faqs.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Frequently Asked Questions
          </h3>
          <div className="flex flex-col gap-2">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180 text-brand-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Related Tools Internal Linking */}
      {relatedTools && relatedTools.length > 0 && (
        <section className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Explore Related Tools
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {relatedTools.map((t) => (
              <Link
                key={t!.id}
                to={t!.route}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-500 hover:shadow-subtle transition-all group"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-brand-600">
                    {t!.name}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {t!.description}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 group-hover:text-brand-600 transition-transform" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
