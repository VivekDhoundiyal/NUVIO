import React, { useState } from 'react';
import { RotateCw, Copy, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { PageInfo } from '../../types/document';
import { IconButton } from '../../components/ui/IconButton';

export interface EditorThumbnailsProps {
  pages: PageInfo[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onRotatePage: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onAddBlankPage?: () => void;
}

export const EditorThumbnails: React.FC<EditorThumbnailsProps> = ({
  pages,
  currentPageIndex,
  onSelectPage,
  onRotatePage,
  onDuplicatePage,
  onDeletePage,
  onAddBlankPage,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-paper-300 dark:border-ink-800 bg-white dark:bg-ink-900 flex flex-col items-center py-3 h-full shrink-0 transition-all duration-200">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          title="Expand page thumbnails"
          className="p-2 rounded-lg text-ink-600 dark:text-ink-400 hover:bg-paper-200 dark:hover:bg-ink-800 hover:text-brand-600 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-mono text-ink-500 mt-3 rotate-90 whitespace-nowrap">
          {pages.length} Pages
        </span>
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-paper-300 dark:border-ink-800 bg-white dark:bg-ink-900 flex flex-col h-full shrink-0 transition-all duration-200">
      <div className="p-3 border-b border-paper-200 dark:border-ink-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse page thumbnails"
            className="p-1 rounded text-ink-500 hover:text-brand-600 hover:bg-paper-200 dark:hover:bg-ink-800 transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-ink-800 dark:text-ink-200">
            Pages ({pages.length})
          </span>
        </div>
        {onAddBlankPage && (
          <button
            type="button"
            onClick={onAddBlankPage}
            className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium px-2 py-0.5 rounded hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
          >
            + Add Page
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {pages.map((page, idx) => {
          const isSelected = idx === currentPageIndex;

          return (
            <div
              key={idx}
              className={`group relative flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950/40'
              }`}
              onClick={() => onSelectPage(idx)}
            >
              {/* Page Preview Thumbnail */}
              <div
                className="w-full aspect-[1/1.4] bg-white border border-slate-200 shadow-sm rounded flex items-center justify-center overflow-hidden transition-transform"
                style={{ transform: `rotate(${page.rotation || 0}deg)` }}
              >
                {page.thumbnailUrl ? (
                  <img
                    src={page.thumbnailUrl}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] font-mono text-slate-400">Page {idx + 1}</span>
                )}
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between w-full mt-2 text-xs">
                <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  #{idx + 1}
                </span>

                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  <IconButton
                    size="sm"
                    aria-label={`Rotate page ${idx + 1}`}
                    title="Rotate 90°"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(idx);
                    }}
                  >
                    <RotateCw className="w-3 h-3" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={`Duplicate page ${idx + 1}`}
                    title="Duplicate page"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(idx);
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </IconButton>
                  {pages.length > 1 && (
                    <IconButton
                      size="sm"
                      variant="danger"
                      aria-label={`Delete page ${idx + 1}`}
                      title="Delete page"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(idx);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </IconButton>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
