'use client';

import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { isValidHexColor } from 'glow-presets';

const DEFAULT_MAX_COLORS = 12;
const DEFAULT_MIN_COLORS = 1;

export type ColorPaletteFieldErrors = {
  palette?: string;
  [key: `palette_${number}`]: string | undefined;
};

type ColorPaletteFieldProps = {
  palette: string[];
  onChange: (palette: string[]) => void;
  maxColors?: number;
  minColors?: number;
  disabled?: boolean;
  label?: string;
  errors?: ColorPaletteFieldErrors;
  showGradientPreview?: boolean;
};

function normalizeHexInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('#')) {
    return `#${trimmed}`.slice(0, 7);
  }
  return trimmed.slice(0, 7);
}

export function ColorPaletteField({
  palette,
  onChange,
  maxColors = DEFAULT_MAX_COLORS,
  minColors = DEFAULT_MIN_COLORS,
  disabled = false,
  label = 'Color Palette',
  errors,
  showGradientPreview = false,
}: ColorPaletteFieldProps) {
  const canAdd = palette.length < maxColors && !disabled;
  const canRemove = palette.length > minColors && !disabled;

  function updateColor(index: number, value: string) {
    const next = [...palette];
    next[index] = normalizeHexInput(value);
    onChange(next);
  }

  function addColor() {
    if (!canAdd) return;
    onChange([...palette, '#FFFFFF']);
  }

  function removeColor(index: number) {
    if (!canRemove) return;
    onChange(palette.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">
          {label} ({minColors} to {maxColors} Colors)
        </Label>
        {canAdd && (
          <button
            type="button"
            onClick={addColor}
            className="flex items-center gap-1 text-[10px] font-cyber text-neon-magenta hover:text-foreground transition-all uppercase cursor-pointer"
          >
            <Plus className="size-3" /> Add color
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {palette.map((color, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div
              className={`flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.03] p-2 rounded-xl border ${
                errors?.[`palette_${idx}`] ? 'border-red-500/40' : 'border-black/5 dark:border-white/5'
              }`}
            >
              <input
                type="color"
                value={isValidHexColor(color) ? color : '#000000'}
                disabled={disabled}
                onChange={(e) => updateColor(idx, e.target.value)}
                className="size-8 rounded-lg border-0 bg-transparent cursor-pointer p-0 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                type="text"
                value={color.toUpperCase()}
                disabled={disabled}
                onChange={(e) => updateColor(idx, e.target.value)}
                maxLength={7}
                className="w-18 bg-transparent border-0 font-mono text-xs uppercase focus:ring-0 text-foreground p-0 disabled:opacity-50"
              />
              {canRemove && (
                <button
                  type="button"
                  onClick={() => removeColor(idx)}
                  className="text-red-500/70 hover:text-red-500 p-1 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {errors?.[`palette_${idx}`] && (
              <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold">
                {errors[`palette_${idx}`]}
              </p>
            )}
          </div>
        ))}
      </div>

      {showGradientPreview && palette.length > 0 && (
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
      )}

      {errors?.palette && (
        <p className="text-[10px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">
          {errors.palette}
        </p>
      )}
    </div>
  );
}

export function validatePalette(
  palette: string[],
  maxColors: number
): ColorPaletteFieldErrors {
  const errors: ColorPaletteFieldErrors = {};

  if (palette.length === 0) {
    errors.palette = 'Please add at least one color.';
  } else if (palette.length > maxColors) {
    errors.palette = `Color palette cannot exceed ${maxColors} colors.`;
  }

  palette.forEach((color, idx) => {
    if (!isValidHexColor(color)) {
      errors[`palette_${idx}`] = 'Invalid HEX format (e.g. #FF0055).';
    }
  });

  return errors;
}
