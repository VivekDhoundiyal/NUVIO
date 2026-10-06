import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import { Sparkles, Copy, Check, Download, GitCompare } from 'lucide-react';
import * as Diff from 'diff';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/useToast';

export const TextToolsPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'transform' | 'diff'>('transform');
  const [text, setText] = useState('');
  const [diffTextA, setDiffTextA] = useState('');
  const [diffTextB, setDiffTextB] = useState('');
  const [diffChanges, setDiffChanges] = useState<Diff.Change[]>([]);
  const [hasCopied, setHasCopied] = useState(false);

  // Stats
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lineCount = text ? text.split('\n').length : 0;

  // Transformations
  const toUppercase = () => setText(text.toUpperCase());
  const toLowercase = () => setText(text.toLowerCase());
  const toTitleCase = () => {
    setText(
      text.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      )
    );
  };
  const toCamelCase = () => {
    setText(
      text
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/\s+/g, '')
    );
  };
  const toKebabCase = () => {
    setText(
      text
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
    );
  };
  const cleanWhitespace = () => {
    setText(
      text
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ' '))
        .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
        .join('\n')
    );
    toast.success('Cleaned extra whitespace');
  };
  const deduplicateLines = () => {
    const lines = text.split('\n');
    const unique = Array.from(new Set(lines));
    setText(unique.join('\n'));
    toast.success('Deduplicated lines', `Removed ${lines.length - unique.length} duplicates`);
  };

  const handleDiff = () => {
    const changes = Diff.diffLines(diffTextA, diffTextB);
    setDiffChanges(changes);
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!text) return;
    saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'processed-text.txt');
    toast.success('Downloaded file', 'processed-text.txt');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Text Utilities & Diff</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Case conversion, whitespace cleanup, deduplication, word counter, and side-by-side text diff.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
          tabs={[
            { id: 'transform', label: 'Transform & Cleanup' },
            { id: 'diff', label: 'Text Compare & Diff', icon: <GitCompare className="w-3.5 h-3.5" /> },
          ]}
        />

        {activeTab === 'transform' ? (
          <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
            {/* Stats bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex gap-4">
                <span>Words: <strong className="text-slate-800 dark:text-slate-200">{wordCount}</strong></span>
                <span>Characters: <strong className="text-slate-800 dark:text-slate-200">{charCount}</strong></span>
                <span>Lines: <strong className="text-slate-800 dark:text-slate-200">{lineCount}</strong></span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={handleCopy}
                >
                  {hasCopied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={handleDownload}
                >
                  Download
                </Button>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Button variant="secondary" size="sm" onClick={toUppercase}>
                UPPERCASE
              </Button>
              <Button variant="secondary" size="sm" onClick={toLowercase}>
                lowercase
              </Button>
              <Button variant="secondary" size="sm" onClick={toTitleCase}>
                Title Case
              </Button>
              <Button variant="secondary" size="sm" onClick={toCamelCase}>
                camelCase
              </Button>
              <Button variant="secondary" size="sm" onClick={toKebabCase}>
                kebab-case
              </Button>
              <Button variant="secondary" size="sm" onClick={cleanWhitespace}>
                Clean Whitespace
              </Button>
              <Button variant="secondary" size="sm" onClick={deduplicateLines}>
                Deduplicate Lines
              </Button>
            </div>

            <textarea
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type text here..."
              className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Original Text (A)
                </label>
                <textarea
                  rows={8}
                  value={diffTextA}
                  onChange={(e) => setDiffTextA(e.target.value)}
                  placeholder="Paste original text here..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Modified Text (B)
                </label>
                <textarea
                  rows={8}
                  value={diffTextB}
                  onChange={(e) => setDiffTextB(e.target.value)}
                  placeholder="Paste modified text here..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <Button variant="primary" size="md" leftIcon={<GitCompare className="w-4 h-4" />} onClick={handleDiff}>
              Compare Differences
            </Button>

            {diffChanges.length > 0 && (
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Diff Comparison Result
                </span>
                <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
                  {diffChanges.map((part, index) => {
                    const color = part.added
                      ? 'bg-emerald-950 text-emerald-400'
                      : part.removed
                      ? 'bg-red-950 text-red-400 line-through'
                      : 'text-slate-300';
                    return (
                      <span key={index} className={color}>
                        {part.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
