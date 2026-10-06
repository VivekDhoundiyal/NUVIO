import React, { useRef, useState, useEffect } from 'react';
import { RotateCw, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import type { AnnotationObject } from '../../types/document';
import { CoordinateEngine } from '../../engines/pdf/coordinateEngine';

interface TransformableObjectProps {
  obj: AnnotationObject;
  zoom: number;
  isSelected: boolean;
  pageWidth: number;
  pageHeight: number;
  lockAspectRatio?: boolean;
  onSelect: () => void;
  onUpdate: (updated: Partial<AnnotationObject>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onDragPageHandoff?: (newPageIndex: number, newX: number, newY: number) => void;
  children: React.ReactNode;
}

type HandleType = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | 'rot';

export const TransformableObject: React.FC<TransformableObjectProps> = ({
  obj,
  zoom,
  isSelected,
  pageWidth,
  pageHeight,
  lockAspectRatio,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onDragPageHandoff,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<HandleType | 'drag' | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [startBox, setStartBox] = useState<{ x: number; y: number; width: number; height: number; rotation: number } | null>(null);

  // Keyboard navigation & nudging (Arrow keys: 1pt, Shift+Arrow: 10pt, Delete/Backspace: delete)
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const step = e.shiftKey ? 10 : 1;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onUpdate({ y: Math.max(0, obj.y - step) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onUpdate({ y: obj.y + step });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onUpdate({ x: Math.max(0, obj.x - step) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onUpdate({ x: obj.x + step });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, obj.x, obj.y, onUpdate, onDelete]);

  // Screen coordinates
  const left = obj.x * zoom;
  const top = obj.y * zoom;
  const width = obj.width * zoom;
  const height = obj.height * zoom;
  const rotation = obj.rotation || 0;

  const isDefaultAspectLocked =
    lockAspectRatio !== undefined
      ? lockAspectRatio
      : obj.type === 'signature' || obj.type === 'stamp' || obj.type === 'image';

  // Handle pointer down for drag
  const handleBodyPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }

    setActiveHandle('drag');
    setStartPoint({ x: e.clientX, y: e.clientY });
    setStartBox({ x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation || 0 });
  };

  // Handle pointer down for resize/rotate handles
  const handleHandlePointerDown = (e: React.PointerEvent, handle: HandleType) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    setActiveHandle(handle);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setStartBox({ x: obj.x, y: obj.y, width: obj.width, height: obj.height, rotation: obj.rotation || 0 });
  };

  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<Partial<AnnotationObject> | null>(null);

  const scheduleUpdate = (update: Partial<AnnotationObject>) => {
    pendingUpdateRef.current = update;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingUpdateRef.current) {
          onUpdate(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
        rafRef.current = null;
      });
    }
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !startPoint || !startBox) return;
    e.stopPropagation();

    const deltaX = (e.clientX - startPoint.x) / zoom;
    const deltaY = (e.clientY - startPoint.y) / zoom;

    // 1. DRAG OPERATION (with cross-page handoff support)
    if (activeHandle === 'drag') {
      // Check cross-page dragging if pointer leaves local page vertical range
      if (onDragPageHandoff && typeof document !== 'undefined') {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const targetPageEl = elements.find((el) => el.id && el.id.startsWith('nuvio-page-'));
        if (targetPageEl) {
          const targetPageIdx = parseInt(targetPageEl.id.replace('nuvio-page-', ''), 10);
          if (!isNaN(targetPageIdx) && targetPageIdx !== obj.pageIndex) {
            const pageRect = targetPageEl.getBoundingClientRect();
            const newX = Math.max(0, Math.round((e.clientX - pageRect.left) / zoom - obj.width / 2));
            const newY = Math.max(0, Math.round((e.clientY - pageRect.top) / zoom - obj.height / 2));
            onDragPageHandoff(targetPageIdx, newX, newY);
            return;
          }
        }
      }

      const nextX = Math.round(startBox.x + deltaX);
      const nextY = Math.round(startBox.y + deltaY);
      const boundedX = Math.max(0, Math.min(pageWidth - obj.width, nextX));
      const boundedY = Math.max(0, Math.min(pageHeight - obj.height, nextY));
      scheduleUpdate({ x: boundedX, y: boundedY });
      return;
    }

    // 2. ROTATION OPERATION
    if (activeHandle === 'rot') {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      let deg = Math.round((rad * 180) / Math.PI + 90);
      if (deg < 0) deg += 360;

      // Snapping to 15-degree steps when Shift is held
      if (e.shiftKey) {
        deg = CoordinateEngine.snapAngle(deg, 15);
      }

      scheduleUpdate({ rotation: deg % 360 });
      return;
    }

    // 3. RESIZE OPERATION
    const isRatioLocked = e.shiftKey ? !isDefaultAspectLocked : isDefaultAspectLocked;

    let newWidth = startBox.width;
    let newHeight = startBox.height;
    let newX = startBox.x;
    let newY = startBox.y;

    // Corner handles with optional Aspect Ratio Lock
    if (activeHandle === 'se') {
      if (isRatioLocked) {
        const rawW = Math.max(20, startBox.width + deltaX);
        const rawH = Math.max(20, startBox.height + deltaY);
        const scale = Math.max(rawW / startBox.width, rawH / startBox.height);
        newWidth = Math.round(startBox.width * scale);
        newHeight = Math.round(startBox.height * scale);
      } else {
        newWidth = Math.max(20, Math.round(startBox.width + deltaX));
        newHeight = Math.max(20, Math.round(startBox.height + deltaY));
      }
    } else if (activeHandle === 'sw') {
      if (isRatioLocked) {
        const rawW = Math.max(20, startBox.width - deltaX);
        const rawH = Math.max(20, startBox.height + deltaY);
        const scale = Math.max(rawW / startBox.width, rawH / startBox.height);
        newWidth = Math.round(startBox.width * scale);
        newHeight = Math.round(startBox.height * scale);
        newX = Math.round(startBox.x + startBox.width - newWidth);
      } else {
        const diff = Math.round(deltaX);
        if (startBox.width - diff >= 20) {
          newWidth = startBox.width - diff;
          newX = startBox.x + diff;
        }
        newHeight = Math.max(20, Math.round(startBox.height + deltaY));
      }
    } else if (activeHandle === 'ne') {
      if (isRatioLocked) {
        const rawW = Math.max(20, startBox.width + deltaX);
        const rawH = Math.max(20, startBox.height - deltaY);
        const scale = Math.max(rawW / startBox.width, rawH / startBox.height);
        newWidth = Math.round(startBox.width * scale);
        newHeight = Math.round(startBox.height * scale);
        newY = Math.round(startBox.y + startBox.height - newHeight);
      } else {
        newWidth = Math.max(20, Math.round(startBox.width + deltaX));
        const diff = Math.round(deltaY);
        if (startBox.height - diff >= 20) {
          newHeight = startBox.height - diff;
          newY = startBox.y + diff;
        }
      }
    } else if (activeHandle === 'nw') {
      if (isRatioLocked) {
        const rawW = Math.max(20, startBox.width - deltaX);
        const rawH = Math.max(20, startBox.height - deltaY);
        const scale = Math.max(rawW / startBox.width, rawH / startBox.height);
        newWidth = Math.round(startBox.width * scale);
        newHeight = Math.round(startBox.height * scale);
        newX = Math.round(startBox.x + startBox.width - newWidth);
        newY = Math.round(startBox.y + startBox.height - newHeight);
      } else {
        const diffX = Math.round(deltaX);
        const diffY = Math.round(deltaY);
        if (startBox.width - diffX >= 20) {
          newWidth = startBox.width - diffX;
          newX = startBox.x + diffX;
        }
        if (startBox.height - diffY >= 20) {
          newHeight = startBox.height - diffY;
          newY = startBox.y + diffY;
        }
      }
    } else {
      // Edge handles (directional stretch)
      if (activeHandle === 'e') {
        newWidth = Math.max(20, Math.round(startBox.width + deltaX));
      }
      if (activeHandle === 's') {
        newHeight = Math.max(20, Math.round(startBox.height + deltaY));
      }
      if (activeHandle === 'w') {
        const diff = Math.round(deltaX);
        if (startBox.width - diff >= 20) {
          newWidth = startBox.width - diff;
          newX = startBox.x + diff;
        }
      }
      if (activeHandle === 'n') {
        const diff = Math.round(deltaY);
        if (startBox.height - diff >= 20) {
          newHeight = startBox.height - diff;
          newY = startBox.y + diff;
        }
      }
    }

    scheduleUpdate({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: Math.max(20, newWidth),
      height: Math.max(20, newHeight),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingUpdateRef.current) {
        onUpdate(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      setActiveHandle(null);
      setStartPoint(null);
      setStartBox(null);
    }
  };

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={`${obj.type} object at ${Math.round(obj.x)}, ${Math.round(obj.y)}`}
      className={`absolute select-none touch-none ${
        isSelected
          ? 'ring-2 ring-brand-500 ring-offset-1 z-30 cursor-move'
          : 'hover:ring-1 hover:ring-brand-400/60 z-20 cursor-pointer'
      }`}
      style={{
        left,
        top,
        width,
        height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Object content */}
      <div className="w-full h-full pointer-events-none overflow-hidden">{children}</div>

      {/* Selected Controls */}
      {isSelected && (
        <>
          {/* Quick Floating Action Bar */}
          <div
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/90 text-white px-2 py-1 rounded-md shadow-lg pointer-events-auto text-xs z-40 backdrop-blur-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {onBringForward && (
              <button
                type="button"
                onClick={onBringForward}
                title="Bring Forward (Bring up layer)"
                aria-label="Bring Forward"
                className="p-1 hover:text-brand-300 transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
            {onSendBackward && (
              <button
                type="button"
                onClick={onSendBackward}
                title="Send Backward (Send down layer)"
                aria-label="Send Backward"
                className="p-1 hover:text-brand-300 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                onClick={onDuplicate}
                title="Duplicate object"
                aria-label="Duplicate object"
                className="p-1 hover:text-brand-300 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              title="Delete object (Del / Backspace)"
              aria-label="Delete object"
              className="p-1 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotation Handle */}
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => handleHandlePointerDown(e, 'rot')}
            title="Rotate object (Hold Shift for 15° snap)"
            aria-label="Rotate object"
          >
            <div className="w-4 h-4 bg-white dark:bg-slate-800 border-2 border-brand-500 rounded-full flex items-center justify-center shadow-xs">
              <RotateCw className="w-2.5 h-2.5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="w-0.5 h-2 bg-brand-500" />
          </div>

          {/* Corner Resize Handles */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-brand-500 rounded-xs cursor-nwse-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'nw')}
            aria-label="Resize top-left"
            title={isDefaultAspectLocked ? 'Resize (Hold Shift to unlock aspect ratio)' : 'Resize (Hold Shift to lock aspect ratio)'}
          />
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-brand-500 rounded-xs cursor-nesw-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'ne')}
            aria-label="Resize top-right"
            title={isDefaultAspectLocked ? 'Resize (Hold Shift to unlock aspect ratio)' : 'Resize (Hold Shift to lock aspect ratio)'}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-brand-500 rounded-xs cursor-nwse-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'se')}
            aria-label="Resize bottom-right"
            title={isDefaultAspectLocked ? 'Resize (Hold Shift to unlock aspect ratio)' : 'Resize (Hold Shift to lock aspect ratio)'}
          />
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-brand-500 rounded-xs cursor-nesw-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'sw')}
            aria-label="Resize bottom-left"
            title={isDefaultAspectLocked ? 'Resize (Hold Shift to unlock aspect ratio)' : 'Resize (Hold Shift to lock aspect ratio)'}
          />

          {/* Edge Handles */}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-brand-500 rounded-xs cursor-ns-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'n')}
            aria-label="Resize top"
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-brand-500 rounded-xs cursor-ns-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 's')}
            aria-label="Resize bottom"
          />
          <div
            className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-4 bg-white border border-brand-500 rounded-xs cursor-ew-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'w')}
            aria-label="Resize left"
          />
          <div
            className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-4 bg-white border border-brand-500 rounded-xs cursor-ew-resize shadow-xs pointer-events-auto"
            onPointerDown={(e) => handleHandlePointerDown(e, 'e')}
            aria-label="Resize right"
          />
        </>
      )}
    </div>
  );
};
