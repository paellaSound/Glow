import { hslToHex } from '../utils/color.js';
export function renderRainbow(ctx) {
    const t = ctx.timeMs / 1000;
    const x = ctx.col;
    const y = ctx.row;
    const hue = (t * 120 + x * 30 + y * 20) % 360;
    return hslToHex(hue, 100, 50);
}
