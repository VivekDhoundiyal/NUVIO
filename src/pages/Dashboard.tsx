import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileEdit,
  FileText,
  ArrowRight,
  Lock,
  Search,
  Star,
  Clock,
  ShieldCheck,
  Layers,
  Scissors,
  Minimize2,
  Stamp,
  KeyRound,
  EyeOff,
  ScanText,
  UploadCloud,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  HardDriveDownload,
  Cpu,
  GraduationCap,
  Briefcase,
  Scale,
  Users,
} from 'lucide-react';
import { ALL_TOOLS, TOOL_CATEGORIES, searchTools } from '../registry/toolRegistry';
import type { ToolDefinition } from '../types/tools';
import { StorageService } from '../services/storage/db';
import { FileSessionStore } from '../services/storage/fileSessionStore';
import { SEOHead } from '../features/seo/SEOHead';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recentToolIds, setRecentToolIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Hero Dropzone state
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    StorageService.getRecentTools(6).then(setRecentToolIds);
    StorageService.getFavorites().then(setFavorites);
  }, []);

  const toggleFavorite = async (e: React.MouseEvent, toolId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const isNowFav = await StorageService.toggleFavorite(toolId);
    setFavorites((prev) =>
      isNowFav ? [...prev, toolId] : prev.filter((id) => id !== toolId)
    );
  };

  const handleHeroDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setDroppedFile(file);
      await FileSessionStore.setActiveFile(file);
    }
  };

  const handleHeroFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDroppedFile(file);
      await FileSessionStore.setActiveFile(file);
    }
  };

  const routeWithActiveFile = (route: string) => {
    navigate(route);
  };

  // Filter tools
  const filteredTools = searchTools(searchQuery).filter((tool) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'favorites') return favorites.includes(tool.id);
    return tool.category === selectedCategory;
  });

  const recentTools = recentToolIds
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as ToolDefinition[];

  // Popular curated tools
  const popularTools = [
    { id: 'pdf-editor', name: 'Edit PDF', desc: 'Direct vector text editing & annotations', icon: FileEdit, route: '/edit-pdf', badge: 'Flagship' },
    { id: 'pdf-to-word', name: 'PDF to Word', desc: 'Convert PDF to clean editable DOCX', icon: FileText, route: '/pdf-to-word', badge: 'High Fidelity' },
    { id: 'compress-pdf', name: 'Compress PDF', desc: 'Reduce file size with local optimization', icon: Minimize2, route: '/compress-pdf', badge: 'Lossless' },
    { id: 'watermark-pdf', name: 'Watermark PDF', desc: 'Text & image stamps, presets & live preview', icon: Stamp, route: '/watermark-pdf', badge: 'New Engine' },
    { id: 'merge-pdf', name: 'Merge PDF', desc: 'Combine multiple PDFs in custom page order', icon: Layers, route: '/merge-pdf', badge: 'Fast' },
    { id: 'split-pdf', name: 'Split PDF', desc: 'Extract pages or split into distinct documents', icon: Scissors, route: '/split-pdf', badge: 'Instant' },
    { id: 'ocr-pdf', name: 'Local OCR', desc: 'Extract searchable text with on-device AI', icon: ScanText, route: '/ocr-pdf', badge: 'Private' },
    { id: 'protect-pdf', name: 'Protect PDF', desc: 'AES-256 standard encryption & passwords', icon: KeyRound, route: '/protect-pdf', badge: 'Secure' },
  ];

  const faqs = [
    {
      q: 'How is Nuvio different from iLovePDF, Smallpdf, or Adobe Acrobat?',
      a: 'Unlike cloud services that upload your confidential PDFs to remote servers for processing, Nuvio executes all parsing, editing, rendering, and conversion entirely inside your browser using WebAssembly and Web Workers. Your documents never touch our servers or any third-party cloud.',
    },
    {
      q: 'Is it completely safe to process legal, medical, and financial documents?',
      a: 'Yes. Because processing happens purely on-device using client-side JavaScript, WebAssembly, and local storage, no network payload containing your files is ever transmitted. Nuvio meets the highest privacy and confidentiality standards by design.',
    },
    {
      q: 'Are there hidden limits on file size, page count, or number of daily tasks?',
      a: 'No. Nuvio does not impose subscription paywalls, page limits, watermarks on exported files, or artificial waiting queues. Your hardware and browser memory are the only physical boundaries.',
    },
    {
      q: 'What happens to untouched text and fonts when I edit a PDF?',
      a: 'Nuvio enforces strict PDF-native editing fidelity. Untouched content streams, embedded fonts, vectors, and layouts remain bit-for-bit identical to the original document. We never normalize formatting or destroy original font tables.',
    },
    {
      q: 'Does Nuvio work offline without an active internet connection?',
      a: 'Yes. Once loaded in your browser, Nuvio functions completely offline. You can disconnect your Wi-Fi or work in airplane mode with full access to PDF editing, conversion, splitting, merging, and protection.',
    },
  ];

  return (
    <>
      <SEOHead
        title="NUVIO — Your documents. Done in seconds. | 100% Private PDF Platform"
        description="The world-class browser-native document workstation. Edit text, convert formats, merge, split, compress, sign, and redact documents with zero server uploads and zero paywalls."
        canonicalUrl="/"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-14">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto flex flex-col items-center gap-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-paper-200/80 dark:bg-nuvio-darkSurface border border-nuvio-border dark:border-nuvio-darkBorder text-xs font-semibold text-brand-700 dark:text-brand-300 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-nuvio-cyan" />
            <span>NUVIO • Documents, without the friction • 100% Client-Side</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-nuvio-ink dark:text-white tracking-tight leading-[1.15]">
            Your documents. Done in seconds.{' '}
            <span className="bg-gradient-to-r from-nuvio-indigo via-nuvio-violet to-nuvio-cyan bg-clip-text text-transparent">
              Total privacy.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-nuvio-muted dark:text-nuvio-darkMuted max-w-2xl leading-relaxed">
            The world-class browser-native document workstation. Edit vector text, convert formats, merge, split,
            compress, sign, and redact documents with zero server uploads and zero paywalls.
          </p>

          {/* DOMINANT UPLOAD ARENA ABOVE THE FOLD */}
          <div className="w-full max-w-2xl mt-4">
            {!droppedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleHeroDrop}
                className={`relative flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border-2 border-dashed transition-all duration-200 shadow-paper ${
                  isDragging
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 scale-[1.01]'
                    : 'border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface/60 hover:border-brand-400 dark:hover:border-brand-500'
                }`}
              >
                <input
                  id="hero-file-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleHeroFileInput}
                  className="hidden"
                />
                <label
                  htmlFor="hero-file-input"
                  className="cursor-pointer flex flex-col items-center gap-4 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-subtle group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-nuvio-ink dark:text-white">
                      Drop a PDF here or <span className="text-brand-600 underline">choose a file</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-nuvio-muted dark:text-nuvio-darkMuted mt-1">
                      Instant local processing • Files never leave your device • Up to 2GB supported
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper-200/60 dark:bg-nuvio-darkSecondary text-xs font-medium text-nuvio-muted dark:text-nuvio-darkMuted">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>100% Private Client-Side Processing</span>
                  </div>
                </label>
              </div>
            ) : (
              /* QUICK ACTION SELECTOR WHEN FILE IS DROPPED */
              <div className="bg-white dark:bg-nuvio-darkSurface border border-brand-300 dark:border-brand-800 rounded-3xl p-6 sm:p-8 shadow-paper flex flex-col gap-5 text-left animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-paper-200 dark:border-nuvio-darkBorder">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-nuvio-ink dark:text-white truncate max-w-xs sm:max-w-md">
                        {droppedFile.name}
                      </h3>
                      <p className="text-xs text-nuvio-muted font-mono">
                        {(droppedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDroppedFile(null);
                      FileSessionStore.clear();
                    }}
                    className="text-xs text-nuvio-muted hover:text-nuvio-ink dark:hover:text-white underline"
                  >
                    Change file
                  </button>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-nuvio-muted block mb-2">
                    What would you like to do?
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/edit-pdf')}
                      className="p-3 rounded-xl border border-brand-500 bg-brand-50/80 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/80 text-left transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <FileEdit className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-600 text-white">
                          Direct
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Edit PDF</div>
                        <div className="text-[11px] text-nuvio-muted">Direct editor</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/pdf-to-word')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">To Word</div>
                        <div className="text-[11px] text-nuvio-muted">Export DOCX</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/compress-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <Minimize2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Compress</div>
                        <div className="text-[11px] text-nuvio-muted">Reduce size</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/watermark-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <Stamp className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Watermark</div>
                        <div className="text-[11px] text-nuvio-muted">Stamp pages</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/protect-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Protect</div>
                        <div className="text-[11px] text-nuvio-muted">AES-256 lock</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/ocr-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <ScanText className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Local OCR</div>
                        <div className="text-[11px] text-nuvio-muted">Extract text</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/split-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <Scissors className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Split PDF</div>
                        <div className="text-[11px] text-nuvio-muted">Extract pages</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => routeWithActiveFile('/redact-pdf')}
                      className="p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-paper-50 dark:bg-nuvio-darkSecondary/60 hover:border-brand-400 hover:bg-paper-100 text-left transition-all group flex flex-col justify-between"
                    >
                      <EyeOff className="w-5 h-5 text-red-600 dark:text-red-400 mb-2" />
                      <div>
                        <div className="text-xs font-bold text-nuvio-ink dark:text-white">Redact</div>
                        <div className="text-[11px] text-nuvio-muted">Sanitize vectors</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* POPULAR TOOLS SECTION */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-nuvio-ink dark:text-white">Most Popular Tools</h2>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted">Core everyday workflows, processed locally with maximum speed.</p>
            </div>
            <Link to="/edit-pdf" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
              <span>Launch Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {popularTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.id}
                  to={tool.route}
                  className="group p-4 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface hover:border-brand-500 hover:shadow-elevated transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      {tool.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-paper-200 dark:bg-nuvio-darkSecondary text-nuvio-ink dark:text-white">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-nuvio-ink dark:text-white group-hover:text-brand-600 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-[11px] text-nuvio-muted dark:text-nuvio-darkMuted mt-0.5 line-clamp-2">
                      {tool.desc}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-nuvio-border dark:border-nuvio-darkBorder flex items-center justify-between text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* RECENT TOOLS SECTION (IF ANY) */}
        {recentTools.length > 0 && !searchQuery && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-nuvio-muted">
              <Clock className="w-3.5 h-3.5" />
              <span>Recently Used</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {recentTools.map((tool) => {
                const Icon = tool.icon || FileText;
                return (
                  <Link
                    key={tool.id}
                    to={tool.route}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface hover:border-brand-500 transition-all shadow-subtle group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-nuvio-ink dark:text-white truncate group-hover:text-brand-600">
                      {tool.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ALL TOOLS CATEGORIZED MATRIX */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-nuvio-ink dark:text-white">Complete Document Tool Suite</h2>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted mt-0.5">All browser-native tools organized by workflow.</p>
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-nuvio-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface text-nuvio-ink dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-paper-200 dark:bg-nuvio-darkSecondary text-nuvio-muted dark:text-nuvio-darkMuted hover:text-nuvio-ink dark:hover:text-white'
              }`}
            >
              All Tools ({ALL_TOOLS.length})
            </button>
            {favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory('favorites')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'favorites'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-paper-200 dark:bg-nuvio-darkSecondary text-nuvio-muted dark:text-nuvio-darkMuted hover:text-nuvio-ink dark:hover:text-white'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Favorites ({favorites.length})</span>
              </button>
            )}
            {TOOL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-paper-200 dark:bg-nuvio-darkSecondary text-nuvio-muted dark:text-nuvio-darkMuted hover:text-nuvio-ink dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTools.map((tool) => {
              const Icon = tool.icon || FileText;
              const isFav = favorites.includes(tool.id);

              return (
                <Link
                  key={tool.id}
                  to={tool.route}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface hover:border-brand-500 hover:shadow-elevated transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center transition-transform group-hover:scale-105">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {tool.badge && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-paper-200 dark:bg-nuvio-darkSecondary text-nuvio-muted dark:text-nuvio-darkMuted">
                            {tool.badge}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Toggle favorite"
                          onClick={(e) => toggleFavorite(e, tool.id)}
                          className={`p-1 rounded-lg transition-colors ${
                            isFav
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-400 dark:text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-nuvio-ink dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted mt-1 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-nuvio-border dark:border-nuvio-darkBorder flex items-center justify-between text-xs font-semibold text-brand-600 dark:text-brand-400">
                    <span>Open Tool</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* PLAIN-ENGLISH LOCAL PRIVACY GUARANTEE */}
        <section className="bg-gradient-to-br from-nuvio-ink via-slate-900 to-nuvio-darkBg border border-slate-800 rounded-3xl p-8 sm:p-12 text-white shadow-paper">
          <div className="max-w-3xl flex flex-col gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Lock className="w-4 h-4" />
              <span>Guaranteed Local Privacy Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Why Nuvio is 100% private: Your files never leave your computer.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Most online PDF websites upload your sensitive contracts, tax returns, and bank statements to remote servers where they may sit indefinitely. Nuvio takes a fundamentally different path: we bring the entire PDF engine to your browser using modern WebAssembly, Web Workers, and Web Crypto.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                <Cpu className="w-5 h-5 text-nuvio-cyan" />
                <h4 className="text-xs font-bold text-white">Browser-Powered Engine</h4>
                <p className="text-[11px] text-slate-300">Operations run on your CPU & GPU. No server queues or upload bandwidth delays.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                <HardDriveDownload className="w-5 h-5 text-emerald-400" />
                <h4 className="text-xs font-bold text-white">Zero Server Storage</h4>
                <p className="text-[11px] text-slate-300">We do not operate backend file storage. We cannot view or store your files even if requested.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2">
                <CheckCircle2 className="w-5 h-5 text-nuvio-violet" />
                <h4 className="text-xs font-bold text-white">Forever Free & Open</h4>
                <p className="text-[11px] text-slate-300">No subscriptions, no artificial page cutoffs, no watermarks stamped onto your output.</p>
              </div>
            </div>
          </div>
        </section>

        {/* USE CASES SECTION */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-nuvio-ink dark:text-white">Built for Critical Document Workflows</h2>
            <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted mt-0.5">Explore how professionals, students, and organizations utilize Nuvio every day.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-nuvio-ink dark:text-white">Students & Educators</h3>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                Combine lecture slides, highlight syllabus PDFs, extract book chapters, and run OCR on scanned textbook pages without paying for expensive Acrobat licenses.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-nuvio-ink dark:text-white">Legal & Compliance</h3>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                Permanently sanitize underlying text vectors with true vector redaction, apply AES-256 passwords, and verify document integrity with automated quality audits.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-nuvio-ink dark:text-white">Freelancers & Creators</h3>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                Sign agreements with digital signatures, stamp custom confidential watermarks, compress high-res portfolio PDFs, and convert invoices to Word seamlessly.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-nuvio-ink dark:text-white">Enterprise Teams</h3>
              <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed">
                Empower team members to edit and optimize PDFs without risking GDPR, HIPAA, or corporate NDA violations from cloud document processors.
              </p>
            </div>
          </div>
        </section>

        {/* SEO GUIDES & FAQ ACCORDION */}
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-nuvio-ink dark:text-white">Frequently Asked Questions</h2>
            <p className="text-xs text-nuvio-muted dark:text-nuvio-darkMuted mt-0.5">Everything you need to know about Nuvio&apos;s local-first architecture.</p>
          </div>

          <div className="flex flex-col gap-3">
            {faqs.map((faq, idx) => {
              const isOpen = faqOpenIndex === idx;
              return (
                <div
                  key={idx}
                  className="border border-nuvio-border dark:border-nuvio-darkBorder rounded-2xl bg-white dark:bg-nuvio-darkSurface overflow-hidden transition-all shadow-subtle"
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpenIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-nuvio-ink dark:text-white hover:text-brand-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-brand-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs text-nuvio-muted dark:text-nuvio-darkMuted leading-relaxed border-t border-nuvio-border dark:border-nuvio-darkBorder/60 mt-1">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
};
