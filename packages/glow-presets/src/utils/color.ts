export function hslToHex(h: number, s: number, l: number): string {
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

export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

export function lerpHex(from: string, to: string, amount: number): string {
  const clamped = Math.max(0, Math.min(1, amount));
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ] as const;
  };

  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clamped);

  return `#${mix(r1, r2).toString(16).padStart(2, '0')}${mix(g1, g2)
    .toString(16)
    .padStart(2, '0')}${mix(b1, b2).toString(16).padStart(2, '0')}`;
}
