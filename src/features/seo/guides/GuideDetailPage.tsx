import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

import { SEOHead } from '../SEOHead';
import { getGuideBySlug, GUIDES } from './guidesData';

export const GuideDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return <Navigate to="/guides" replace />;
  }

  const guide = getGuideBySlug(slug);

  if (!guide) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-slate-200">Guide Not Found</h1>
        <p className="text-sm text-slate-400 mt-2">
          The guide you requested does not exist or may have moved.
        </p>
        <Link
          to="/guides"
          className="mt-6 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-xs font-semibold text-white transition-colors"
        >
          Return to Knowledge Base
        </Link>
      </div>
    );
  }

  const relatedGuides = GUIDES.filter((g) => g.slug !== guide.slug && g.category === guide.category).slice(0, 2);
  const otherGuides = relatedGuides.length < 2 
    ? [...relatedGuides, ...GUIDES.filter((g) => g.slug !== guide.slug && !relatedGuides.includes(g)).slice(0, 2 - relatedGuides.length)]
    : relatedGuides;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <SEOHead
        title={`${guide.title} | DocuLoom Guide`}
        description={guide.metaDescription}
        canonicalUrl={`https://doculoom.com/guides/${guide.slug}`}
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.title,
          description: guide.metaDescription,
          datePublished: guide.publishedDate,
          dateModified: guide.modifiedDate,
          author: {
            '@type': 'Organization',
            name: 'DocuLoom Editorial & Security Team',
            url: 'https://doculoom.com',
          },
          publisher: {
            '@type': 'Organization',
            name: 'DocuLoom',
            url: 'https://doculoom.com',
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://doculoom.com/guides/${guide.slug}`,
          },
        }}
      />

      {/* Sticky Subnav */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to="/guides" className="hover:text-slate-200 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Guides
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              {guide.category}
            </span>
          </div>

          <Link
            to={guide.relatedToolRoute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-400 text-xs font-semibold border border-brand-500/30 transition-colors"
          >
            Launch {guide.relatedToolName}
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Article Content Container */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full flex flex-col gap-10">
        {/* Article Header */}
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {guide.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {guide.readTimeMinutes} min read
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              Updated {guide.modifiedDate}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100 leading-tight">
            {guide.title}
          </h1>

          <p className="text-base text-slate-300 leading-relaxed">
            {guide.summary}
          </p>

          {/* Key Takeaways Callout */}
          <div className="mt-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Key Takeaways
            </span>
            <ul className="space-y-2">
              {guide.keyTakeaways.map((takeaway, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        {/* Table of Contents */}
        <aside className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3">
            Table of Contents
          </span>
          <ol className="space-y-2">
            {guide.sections.map((section, idx) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-xs text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-2"
                >
                  <span className="font-mono text-slate-500">{idx + 1}.</span>
                  <span>{section.heading}</span>
                </a>
              </li>
            ))}
            {guide.faqs.length > 0 && (
              <li>
                <a
                  href="#frequently-asked-questions"
                  className="text-xs text-brand-400 hover:text-brand-300 hover:underline flex items-center gap-2"
                >
                  <span className="font-mono text-slate-500">{guide.sections.length + 1}.</span>
                  <span>Frequently Asked Questions</span>
                </a>
              </li>
            )}
          </ol>
        </aside>

        {/* Main Sections */}
        <article className="flex flex-col gap-10">
          {guide.sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="flex flex-col gap-4 scroll-mt-20">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 pb-2 border-b border-slate-800/60">
                {sec.heading}
              </h2>

              {sec.paragraphs.map((p, pIdx) => (
                <p key={pIdx} className="text-sm text-slate-300 leading-relaxed">
                  {p}
                </p>
              ))}

              {sec.steps && (
                <div className="flex flex-col gap-3 my-2">
                  {sec.steps.map((st, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3.5"
                    >
                      <span className="w-6 h-6 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-bold font-mono flex items-center justify-center shrink-0">
                        {sIdx + 1}
                      </span>
                      <div className="flex flex-col gap-1">
                        <h4 className="text-xs font-bold text-slate-200">{st.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sec.tip && (
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3 leading-relaxed">
                  <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5 text-emerald-200">Pro Tip</span>
                    {sec.tip}
                  </div>
                </div>
              )}

              {sec.warning && (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5 text-amber-200">Security Notice</span>
                    {sec.warning}
                  </div>
                </div>
              )}
            </section>
          ))}

          {/* FAQs Section */}
          {guide.faqs.length > 0 && (
            <section id="frequently-asked-questions" className="flex flex-col gap-4 scroll-mt-20 pt-4">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 pb-2 border-b border-slate-800/60">
                Frequently Asked Questions
              </h2>
              <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                {guide.faqs.map((faq, fIdx) => (
                  <div key={fIdx} className="p-5 flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">
                      {faq.question}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Action Callout Box */}
        <section className="bg-gradient-to-br from-brand-950/50 to-slate-950 border border-brand-500/30 rounded-2xl p-8 text-center flex flex-col items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-100">
            Ready to Try It Yourself?
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            Use DocuLoom’s free client-side {guide.relatedToolName} right now. No signup, no files leaving your computer.
          </p>
          <Link
            to={guide.relatedToolRoute}
            className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all inline-flex items-center gap-2"
          >
            Launch {guide.relatedToolName}
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </section>

        {/* Related Guides */}
        {otherGuides.length > 0 && (
          <section className="border-t border-slate-800 pt-8 flex flex-col gap-4">
            <h3 className="text-base font-bold text-slate-200">
              Related Articles & Tutorials
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {otherGuides.map((item) => (
                <Link
                  key={item.slug}
                  to={`/guides/${item.slug}`}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-brand-400 transition-colors mt-1 line-clamp-2">
                      {item.title}
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-3">
                    Read Guide →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
