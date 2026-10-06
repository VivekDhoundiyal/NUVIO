import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, ArrowRight, Search, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { GUIDES } from './guidesData';

export const GuideIndexPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Editing', 'Conversion', 'Security', 'Optimization'];

  const filteredGuides = GUIDES.filter((guide) => {
    const matchesCategory = selectedCategory === 'All' || guide.category === selectedCategory;
    const matchesSearch =
      guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.keyTakeaways.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <SEOHead
        title="PDF Guides, Tutorials & Best Practices (2026) | DocuLoom"
        description="Comprehensive, step-by-step PDF tutorials and guides. Learn how to edit, convert, protect, sign, redact, and compress PDF documents securely without expensive subscriptions."
        canonicalUrl="https://doculoom.com/guides"
        jsonLdSchema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'DocuLoom PDF Knowledge Base & Guides',
          description: 'Expert guides on client-side PDF editing, conversion, security, and document management.',
          url: 'https://doculoom.com/guides',
          hasPart: GUIDES.map((g) => ({
            '@type': 'Article',
            name: g.title,
            headline: g.title,
            url: `https://doculoom.com/guides/${g.slug}`,
            description: g.metaDescription,
          })),
        }}
      />

      {/* Hero Header */}
      <section className="border-b border-slate-800 bg-slate-950/60 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base & Tutorials
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-100">
            Master PDF Productivity & Security
          </h1>
          <p className="text-base text-slate-400 mt-4 max-w-2xl">
            In-depth guides, practical step-by-step tutorials, and industry best practices for editing, 
            converting, protecting, and optimizing PDF files—without cloud compromises.
          </p>

          {/* Search Bar */}
          <div className="mt-8 w-full max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search guides, topics, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 shadow-inner"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Guide Cards Grid */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full">
        {filteredGuides.length === 0 ? (
          <div className="text-center py-16 bg-slate-950/40 rounded-2xl border border-slate-800">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300">No guides found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search terms or selecting another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGuides.map((guide) => (
              <article
                key={guide.slug}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-all hover:shadow-xl group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {guide.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      {guide.readTimeMinutes} min read
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-100 group-hover:text-brand-400 transition-colors line-clamp-2">
                    <Link to={`/guides/${guide.slug}`}>{guide.title}</Link>
                  </h2>

                  <p className="text-xs text-slate-400 mt-2.5 line-clamp-3 leading-relaxed">
                    {guide.summary}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-800/80">
                    <span className="text-[11px] font-medium text-slate-400 block mb-1.5 uppercase tracking-wider">
                      Key Highlights:
                    </span>
                    <ul className="space-y-1">
                      {guide.keyTakeaways.slice(0, 2).map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <Link
                    to={guide.relatedToolRoute}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                  >
                    Open {guide.relatedToolName} →
                  </Link>
                  <Link
                    to={`/guides/${guide.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 group-hover:text-white transition-colors"
                  >
                    Read Guide
                    <ArrowRight className="w-3.5 h-3.5 text-brand-400 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Global Security / Privacy Guarantee Banner */}
        <section className="mt-16 bg-gradient-to-r from-brand-950/40 via-slate-950 to-slate-900 border border-brand-500/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                100% Client-Side Architecture
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                Unlike traditional PDF services that upload your private documents to cloud clusters, DocuLoom executes all parsing, rendering, and vector modification directly on your device. Zero servers, zero logs, zero leaks.
              </p>
            </div>
          </div>
          <Link
            to="/pdf-editor"
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold whitespace-nowrap shadow-lg shadow-brand-600/30 transition-colors"
          >
            Launch PDF Editor
          </Link>
        </section>
      </main>
    </div>
  );
};
