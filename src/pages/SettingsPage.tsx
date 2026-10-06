import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  Trash2,
  Keyboard,
  HardDrive,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { StorageService } from '../services/storage/db';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/useToast';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [sigCount, setSigCount] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const refreshCounts = async () => {
    const [sigs, stamps, recents] = await Promise.all([
      StorageService.getSignatures(),
      StorageService.getSavedStamps(),
      StorageService.getRecentFiles(100),
    ]);
    setSigCount(sigs.length);
    setStampCount(stamps.length);
    setRecentCount(recents.length);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      StorageService.getSignatures(),
      StorageService.getSavedStamps(),
      StorageService.getRecentFiles(100),
    ]).then(([sigs, stamps, recents]) => {
      if (active) {
        setSigCount(sigs.length);
        setStampCount(stamps.length);
        setRecentCount(recents.length);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleClearAllData = async () => {
    await StorageService.clearAllData();
    setIsConfirmClearOpen(false);
    await refreshCounts();
    toast.success('All local storage cleared', 'IndexedDB tables reset.');
  };

  const shortcuts = [
    { key: 'Ctrl/Cmd + K', action: 'Global tool search' },
    { key: 'Ctrl/Cmd + Z', action: 'Undo last editing change' },
    { key: 'Ctrl/Cmd + Y', action: 'Redo previously undone change' },
    { key: 'Delete / Backspace', action: 'Delete selected annotation / overlay' },
    { key: 'Esc', action: 'Deselect active object or close dialog' },
    { key: 'Arrow Keys', action: 'Fine position adjustment for selected object' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-brand-600" />
          <span>Settings & Local Storage</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage local display preferences, view cached offline assets, and clear browser data.
        </p>
      </div>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <Sun className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light Mode', icon: Sun },
            { id: 'dark', label: 'Dark Mode', icon: Moon },
            { id: 'system', label: 'System Sync', icon: Laptop },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = theme === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id as ThemeMode)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{mode.label}</h3>
                  <p className="text-[11px] text-slate-400">
                    {mode.id === 'system' ? 'Follow OS scheme' : 'Force color scheme'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Local Storage & Privacy Management */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <HardDrive className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Privacy & Local Storage (IndexedDB)
          </h2>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          DocuLoom stores user preferences, saved signatures, and draft metadata in your browser's private IndexedDB database. Documents are never transmitted to external cloud databases.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            <span className="text-[11px] text-slate-400 block">Saved Signatures</span>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
              {sigCount}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            <span className="text-[11px] text-slate-400 block">Custom Stamps</span>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
              {stampCount}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            <span className="text-[11px] text-slate-400 block">Recent Files History</span>
            <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">
              {recentCount}
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-start">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-4 h-4" />}
            onClick={() => setIsConfirmClearOpen(true)}
          >
            Clear All Local Data
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <Keyboard className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Keyboard Shortcuts Reference
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {shortcuts.map((sc) => (
            <div key={sc.key} className="flex items-center justify-between py-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">{sc.action}</span>
              <kbd className="px-2 py-0.5 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      <Modal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear All Local Data?"
        description="This will permanently delete all saved signatures, custom stamps, recent history, and local preferences from this browser."
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearAllData}>
              Yes, Clear Everything
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 dark:text-slate-400">
          No cloud data is deleted because none was ever uploaded. All browser storage will be reset to fresh state.
        </p>
      </Modal>
    </div>
  );
};
