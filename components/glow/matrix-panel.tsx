'use client';

import { cn } from '@/lib/utils';
import type { RoomStatePayload } from '@/lib/glow/types';

type MatrixPanelProps = {
  roomState: RoomStatePayload;
  selectedCell?: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
};

export function MatrixPanel({ roomState, selectedCell, onCellClick }: MatrixPanelProps) {
  const { rows, cols, occupied } = roomState.matrix;
  const occupiedMap = new Map(occupied.map((c) => [`${c.row}:${c.col}`, c]));

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rows * cols }).map((_, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const cell = occupiedMap.get(`${row}:${col}`);
        const isSelected = selectedCell?.row === row && selectedCell?.col === col;

        return (
          <button
            key={`${row}-${col}`}
            type="button"
            onClick={() => onCellClick(row, col)}
            className={cn(
              'aspect-square rounded border text-[10px] font-medium transition',
              cell
                ? 'border-orange-500/60 bg-orange-500/20 text-orange-200'
                : 'border-white/10 bg-white/5 text-zinc-500',
              isSelected && 'ring-2 ring-orange-400'
            )}
          >
            {cell?.label ?? '·'}
          </button>
        );
      })}
    </div>
  );
}
