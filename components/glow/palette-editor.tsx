'use client';

import { useCallback } from 'react';
import { Plus, X } from 'lucide-react';

const MAX_COLORS = 12;
const MIN_COLORS = 1;

interface PaletteEditorProps {
  palette: string[];
  onChange: (palette: string[]) => void;
  disabled?: boolean;
  maxColors?: number;
}

export function PaletteEditor({
  palette,
  onChange,
  disabled = false,
  maxColors = MAX_COLORS,
}: PaletteEditorProps) {
  const canAdd = palette.length < maxColors;
  const canRemove = palette.length > MIN_COLORS;

  const handleColorChange = useCallback(
    (index: number, value: string) => {
      const next = [...palette];
      next[index] = value;
      onChange(next);
    },
    [palette, onChange]
  );

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    // Generate a new color that contrasts with the last one
    const last = palette[palette.length - 1] ?? '#FF0055';
    // Shift hue by ~60° for visual variety
    const hueShift = (parseInt(last.slice(1, 3), 16) + 60) % 256;
    const newColor = `#${hueShift.toString(16).padStart(2, '0')}${last.slice(3)}`;
    onChange([...palette, newColor]);
  }, [palette, onChange, canAdd]);

  const handleRemove = useCallback(
    (index: number) => {
      if (!canRemove) return;
      const next = palette.filter((_, i) => i !== index);
      onChange(next);
    },
    [palette, onChange, canRemove]
  );

  return (
    <div className="space-y-4">
      {/* Colour grid */}
      <div className="flex flex-wrap gap-2.5">
        {palette.map((color, index) => (
          <div
            key={index}
            className="group relative flex flex-col items-center gap-1"
          >
            <label
              className="relative cursor-pointer block"
              title={`Colour ${index + 1}: ${color.toUpperCase()}`}
            >
              {/* Swatch */}
              <div
                className="w-11 h-11 rounded-xl border-2 border-white/20 shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:border-white/60"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 14px 2px ${color}60`,
                }}
              />
              {/* Invisible native picker layered over swatch */}
              <input
                type="color"
                value={color}
                disabled={disabled}
                onChange={(e) => handleColorChange(index, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-xl"
                aria-label={`Palette colour ${index + 1}`}
              />
            </label>

            {/* Hex label */}
            <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider select-none">
              {color.toUpperCase()}
            </span>

            {/* Remove button */}
            {canRemove && !disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 hover:border-red-500/60 z-10"
                aria-label={`Remove colour ${index + 1}`}
              >
                <X className="w-2.5 h-2.5 text-zinc-400 hover:text-red-300" />
              </button>
            )}
          </div>
        ))}

        {/* Add colour button */}
        {canAdd && !disabled && (
          <button
            type="button"
            onClick={handleAdd}
            className="w-11 h-11 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center hover:border-neon-cyan/60 hover:bg-neon-cyan/5 transition-all duration-200 group self-start mt-0"
            aria-label="Add palette colour"
          >
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-neon-cyan transition-colors" />
          </button>
        )}
      </div>

      {/* Live gradient preview bar */}
      <div
        className="h-2 rounded-full w-full"
        style={{
          background:
            palette.length === 1
              ? palette[0]
              : `linear-gradient(to right, ${palette.join(', ')})`,
          boxShadow: `0 0 10px 1px ${palette[0]}40`,
        }}
      />

      <p className="text-[10px] font-cyber tracking-wider text-muted-foreground uppercase">
        {palette.length} / {maxColors} colours — click a swatch to edit
      </p>
    </div>
  );
}
