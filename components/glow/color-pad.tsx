'use client';

import { Button } from '@/components/ui/button';

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
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Set color ${color}`}
          className="aspect-square rounded-lg border border-white/10 transition hover:scale-105"
          style={{ backgroundColor: color }}
          onClick={() => onColor(color)}
        />
      ))}
      <Button variant="outline" className="col-span-3 sm:col-span-5" onClick={() => onColor('#000000')}>
        Blackout
      </Button>
    </div>
  );
}
