'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type ResizableTwoColumnProps = {
  left: ReactNode;
  right: ReactNode;
  /** localStorage key for the persisted left-column width (operator preference). */
  storageKey: string;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
};

/**
 * Two-column desk layout (`lg+`) with a draggable divider between the columns.
 * Stacks vertically on narrow screens. Width persists per `storageKey` in
 * localStorage; double-clicking the divider resets to `defaultLeftWidth`.
 */
export function ResizableTwoColumn({
  left,
  right,
  storageKey,
  defaultLeftWidth = 320,
  minLeftWidth = 240,
  minRightWidth = 360,
}: ResizableTwoColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [isWide, setIsWide] = useState(false);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= minLeftWidth) {
      setLeftWidth(stored);
    }
  }, [storageKey, minLeftWidth]);

  const clampWidth = useCallback(
    (width: number) => {
      const container = containerRef.current;
      const max = container
        ? Math.max(minLeftWidth, container.getBoundingClientRect().width - minRightWidth)
        : 560;
      return Math.max(minLeftWidth, Math.min(width, max));
    },
    [minLeftWidth, minRightWidth]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !containerRef.current) return;
      const leftEdge = containerRef.current.getBoundingClientRect().left;
      setLeftWidth(clampWidth(event.clientX - leftEdge));
    },
    [clampWidth]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setLeftWidth((width) => {
        localStorage.setItem(storageKey, String(Math.round(width)));
        return width;
      });
    },
    [storageKey]
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-6 lg:items-start"
      style={
        isWide ? { gridTemplateColumns: `${leftWidth}px 16px minmax(0, 1fr)`, gap: 0 } : undefined
      }
    >
      {left}

      {isWide ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize columns"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => {
            setLeftWidth(defaultLeftWidth);
            localStorage.setItem(storageKey, String(defaultLeftWidth));
          }}
          className="group flex cursor-col-resize select-none items-center justify-center self-stretch"
          style={{ touchAction: 'none' }}
        >
          <div className="h-16 w-1 rounded-full bg-white/15 transition-colors group-hover:bg-neon-cyan/60" />
        </div>
      ) : null}

      {right}
    </div>
  );
}
