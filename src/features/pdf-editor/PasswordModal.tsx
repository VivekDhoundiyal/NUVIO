import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, FileText, ShieldAlert } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export interface PasswordModalProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
  onUnlock: (password: string) => Promise<void>;
  isUnlocking?: boolean;
  errorMessage?: string | null;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  fileName,
  onClose,
  onUnlock,
  isUnlocking = false,
  errorMessage = null,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setLocalError(null);
      // Auto-focus input on opening
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Keep local error in sync or updated by prop
  useEffect(() => {
    if (errorMessage) {
      setLocalError(errorMessage);
    }
  }, [errorMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLocalError('Please enter a password.');
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    try {
      await onUnlock(password);
    } catch (err: any) {
      setLocalError(err.message || 'Incorrect password. Please verify and try again.');
      inputRef.current?.select();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Password Protected PDF"
      description="Enter the password to decrypt and open this document."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Document Info Banner */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-paper-100 dark:bg-ink-800/60 border border-paper-200 dark:border-ink-700/60 text-ink-800 dark:text-ink-200">
          <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
              Document
            </div>
            <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate">{fileName}</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {localError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm animate-fade-in"
          >
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1 font-medium">{localError}</div>
          </div>
        )}

        {/* Password Input */}
        <div>
          <label
            htmlFor="pdf-unlock-password"
            className="block text-xs font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wider mb-1.5"
          >
            Document Password
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="pdf-unlock-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError(null);
              }}
              disabled={isUnlocking}
              placeholder="Enter password to unlock"
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 pr-11 text-sm bg-white dark:bg-ink-900 border border-paper-300 dark:border-ink-700 rounded-xl text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 rounded-lg transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
            Decryption is performed 100% locally in your browser. Passwords and documents are never sent to any server.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-paper-200 dark:border-ink-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isUnlocking}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isUnlocking}
            leftIcon={<Lock className="w-4 h-4" />}
          >
            Unlock & Open
          </Button>
        </div>
      </form>
    </Modal>
  );
};
