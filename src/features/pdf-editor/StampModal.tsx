import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export interface StampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertStamp: (stampText: string, stampType: string, color: string) => void;
}

const DEFAULT_STAMPS = [
  { text: 'APPROVED', color: '#16a34a', bg: '#f0fdf4' },
  { text: 'REJECTED', color: '#dc2626', bg: '#fef2f2' },
  { text: 'CONFIDENTIAL', color: '#dc2626', bg: '#fef2f2' },
  { text: 'DRAFT', color: '#64748b', bg: '#f8fafc' },
  { text: 'PAID', color: '#2563eb', bg: '#eff6ff' },
  { text: 'REVIEW', color: '#d97706', bg: '#fffbeb' },
  { text: 'FINAL', color: '#16a34a', bg: '#f0fdf4' },
  { text: 'COPY', color: '#475569', bg: '#f1f5f9' },
];

export const StampModal: React.FC<StampModalProps> = ({
  isOpen,
  onClose,
  onInsertStamp,
}) => {
  const [selectedStamp, setSelectedStamp] = useState(DEFAULT_STAMPS[0]);
  const [customText, setCustomText] = useState('');
  const [customColor, setCustomColor] = useState('#2563eb');
  const [includeDate, setIncludeDate] = useState(true);

  const handleInsert = () => {
    if (customText.trim()) {
      const displayText = includeDate
        ? `${customText.toUpperCase()} • ${new Date().toLocaleDateString()}`
        : customText.toUpperCase();
      onInsertStamp(displayText, 'CUSTOM', customColor);
    } else {
      const displayText = includeDate
        ? `${selectedStamp.text} • ${new Date().toLocaleDateString()}`
        : selectedStamp.text;
      onInsertStamp(displayText, selectedStamp.text, selectedStamp.color);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select or Create Stamp"
      description="Choose from standard business stamps or customize your own."
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleInsert} leftIcon={<Check className="w-4 h-4" />}>
            Insert Stamp
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Preset stamps grid */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Standard Stamps
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEFAULT_STAMPS.map((stamp) => {
              const isSelected = selectedStamp.text === stamp.text && !customText;
              return (
                <button
                  key={stamp.text}
                  type="button"
                  onClick={() => {
                    setSelectedStamp(stamp);
                    setCustomText('');
                  }}
                  className={`p-3 rounded-xl border-2 text-center font-bold tracking-wider text-xs transition-all ${
                    isSelected
                      ? 'ring-2 ring-brand-500 scale-105'
                      : 'hover:border-slate-400 opacity-90'
                  }`}
                  style={{
                    borderColor: stamp.color,
                    color: stamp.color,
                    backgroundColor: stamp.bg,
                  }}
                >
                  {stamp.text}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom stamp creation */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Custom Stamp Text
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. VERIFIED BY HR"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {/* Color picker */}
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-9 h-9 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Date toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={includeDate}
            onChange={(e) => setIncludeDate(e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          <span>Include today's date tag</span>
        </label>
      </div>
    </Modal>
  );
};
