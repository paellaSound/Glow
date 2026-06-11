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
      className="grid gap-1.5"
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
              'aspect-square rounded-md border text-xs font-cyber transition-all duration-300 cursor-pointer',
              cell
                ? 'border-neon-cyan/70 bg-neon-cyan/15 text-neon-cyan neon-glow-cyan'
                : 'border-white/5 bg-white/5 text-zinc-600 hover:bg-white/10 hover:border-white/10',
              isSelected && 'ring-2 ring-neon-magenta border-neon-magenta/90 shadow-[0_0_12px_rgba(255,0,200,0.4)]'
            )}
          >
            {cell?.label ?? '·'}
          </button>
        );
      })}
    </div>
  );
}
