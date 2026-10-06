import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  Sun,
  Moon,
  Laptop,
  Settings,
  ShieldCheck,
  Menu,
  X,
  FileEdit,
  Files,
  FileText,
  Minimize2,
  BookOpen,
  Info,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { CommandSearch } from './CommandSearch';
import { NuvioLogo } from '../brand/NuvioLogo';

export const Navbar: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const themeIcon = {
    light: <Sun className="w-4 h-4 text-amber-500" />,
    dark: <Moon className="w-4 h-4 text-nuvio-violet" />,
    system: <Laptop className="w-4 h-4 text-slate-400" />,
  };

  const isEditorActive = location.pathname === '/edit-pdf' || location.pathname === '/pdf-editor';

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-nuvio-border/80 dark:border-nuvio-darkBorder/80 bg-white/80 dark:bg-nuvio-darkSurface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Privacy Pill */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <NuvioLogo variant="full" size="md" animated showTagline={false} />
            </Link>

            {/* Privacy Badge */}
            <div className="hidden lg:flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Client-Side • Local Memory</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-nuvio-muted dark:text-nuvio-darkMuted">
            <Link
              to="/edit-pdf"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:text-nuvio-ink dark:hover:text-white ${
                isEditorActive
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 font-semibold'
                  : ''
              }`}
            >
              Edit PDF
            </Link>
            <Link
              to="/pdf-to-word"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:text-nuvio-ink dark:hover:text-white ${
                location.pathname === '/pdf-to-word'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 font-semibold'
                  : ''
              }`}
            >
              PDF to Word
            </Link>
            <Link
              to="/merge-pdf"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:text-nuvio-ink dark:hover:text-white ${
                location.pathname === '/merge-pdf'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 font-semibold'
                  : ''
              }`}
            >
              Merge
            </Link>
            <Link
              to="/compress-pdf"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:text-nuvio-ink dark:hover:text-white ${
                location.pathname === '/compress-pdf'
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 font-semibold'
                  : ''
              }`}
            >
              Compress
            </Link>
            <Link
              to="/guides"
              className={`px-3 py-1.5 rounded-lg transition-colors hover:text-nuvio-ink dark:hover:text-white ${
                location.pathname.startsWith('/guides')
                  ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 font-semibold'
                  : ''
              }`}
            >
              Guides
            </Link>
          </nav>

          {/* Right Action Icons & Search */}
          <div className="flex items-center gap-2">
            {/* Quick search button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-nuvio-border dark:border-nuvio-darkBorder text-nuvio-muted dark:text-nuvio-darkMuted hover:text-nuvio-ink dark:hover:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary transition-colors text-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search tools</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Theme switcher */}
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Current theme: ${theme}. Click to change.`}
              title={`Current theme: ${theme}. Click to change.`}
              className="p-2 rounded-lg text-nuvio-muted hover:text-nuvio-ink dark:hover:text-white hover:bg-slate-100 dark:hover:bg-nuvio-darkSecondary transition-colors"
            >
              {themeIcon[theme]}
            </button>

            {/* Settings link */}
            <Link
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className="p-2 rounded-lg text-nuvio-muted hover:text-nuvio-ink dark:hover:text-white hover:bg-slate-100 dark:hover:bg-nuvio-darkSecondary transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg text-nuvio-muted hover:text-nuvio-ink dark:hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-nuvio-border dark:border-nuvio-darkBorder bg-white dark:bg-nuvio-darkSurface p-4 space-y-2">
            <Link
              to="/edit-pdf"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <FileEdit className="w-4 h-4 text-brand-600" />
              <span>PDF Editor</span>
            </Link>
            <Link
              to="/pdf-to-word"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <FileText className="w-4 h-4 text-brand-600" />
              <span>PDF to Word</span>
            </Link>
            <Link
              to="/merge-pdf"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <Files className="w-4 h-4 text-brand-600" />
              <span>Merge PDF</span>
            </Link>
            <Link
              to="/compress-pdf"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <Minimize2 className="w-4 h-4 text-brand-600" />
              <span>Compress PDF</span>
            </Link>
            <Link
              to="/guides"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <BookOpen className="w-4 h-4 text-brand-600" />
              <span>Guides & Tutorials</span>
            </Link>
            <Link
              to="/qa"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-amber-600 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <Activity className="w-4 h-4" />
              <span>Engine QA Console</span>
            </Link>
            <Link
              to="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <Info className="w-4 h-4 text-brand-600" />
              <span>About Nuvio</span>
            </Link>
            <Link
              to="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg text-sm text-nuvio-ink dark:text-white hover:bg-slate-50 dark:hover:bg-nuvio-darkSecondary"
            >
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <span>Contact & Feedback</span>
            </Link>
          </div>
        )}
      </header>

      {/* Global Command Search Modal */}
      <CommandSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
