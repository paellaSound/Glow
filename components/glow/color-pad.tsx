'use client';

import { NeonButton } from '@/components/ui/neon';

const COLORS = [
  '#FF0055',
  '#00FFCC',
  '#0055FF',
  '#FFFF00',
  '#FF00FF',
  '#FFFFFF',
  '#000000',
  '#FF6600',
  '#9900FF',
];

type ColorPadProps = {
  onColor: (colorHex: string) => void;
};

export function ColorPad({ onColor }: ColorPadProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Set color ${color}`}
          className="aspect-square rounded-full border border-white/10 dark:border-white/5 transition-all duration-300 hover:scale-110 cursor-pointer shadow-md hover:shadow-lg"
          style={{ backgroundColor: color }}
          onClick={() => onColor(color)}
        />
      ))}
      <NeonButton
        color="cyan"
        variant="outline"
        className="col-span-3 sm:col-span-5 h-9 text-xs uppercase tracking-widest border-zinc-800 hover:bg-zinc-900 dark:hover:bg-white/5 dark:border-white/10 text-zinc-400 hover:text-white mt-2"
        onClick={() => onColor('#000000')}
      >
        Blackout
      </NeonButton>
    </div>
  );
}
