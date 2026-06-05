export type PresetContext = {
  row: number;
  col: number;
  timeMs: number;
  seed: number;
  matrixRows: number;
  matrixCols: number;
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function computePresetColor(presetId: string, ctx: PresetContext): string {
  const t = ctx.timeMs / 1000;
  const x = ctx.col;
  const y = ctx.row;

  switch (presetId) {
    case 'solid':
      return '#ff0055';
    case 'flash':
      return Math.floor(t * 2) % 2 === 0 ? '#ffffff' : '#000000';
    case 'pulse': {
      const pulse = (Math.sin(t * 4) + 1) / 2;
      const v = Math.round(pulse * 255);
      return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
    }
    case 'wave': {
      const hue = (x * 20 + y * 15 + t * 80 + ctx.seed) % 360;
      return hslToHex(hue, 100, 50);
    }
    case 'rainbow': {
      const hue = (t * 120 + x * 30 + y * 20) % 360;
      return hslToHex(hue, 100, 50);
    }
    case 'diagonal': {
      const phase = (x + y + Math.floor(t * 3)) % 3;
      return phase === 0 ? '#ff0055' : phase === 1 ? '#00ffcc' : '#0055ff';
    }
    case 'strobe':
      return Math.floor(t * 8) % 2 === 0 ? '#ffffff' : '#ff0055';
    default:
      return '#111111';
  }
}

export function computeFallbackColor(
  roomCode: string,
  seedTimestamp: number,
  row: number,
  col: number,
  now: number
): string {
  const elapsed = now - seedTimestamp;
  const seed = hashSeed(`${roomCode}:${seedTimestamp}`);
  return computePresetColor('wave', {
    row,
    col,
    timeMs: elapsed,
    seed,
    matrixRows: 25,
    matrixCols: 25,
  });
}

export const PRESET_LABELS: Record<string, string> = {
  solid: 'Solid Red',
  flash: 'Flash',
  pulse: 'Pulse',
  wave: 'Wave',
  rainbow: 'Rainbow',
  diagonal: 'Diagonal',
  strobe: 'Strobe',
};
