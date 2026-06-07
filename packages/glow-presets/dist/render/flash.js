import { paletteColorAt } from '../utils/palette.js';
export function renderFlash(ctx) {
    const t = ctx.timeMs / 1000;
    const phase = Math.floor(t * 2) % 2;
    if (ctx.palette?.length) {
        return phase === 0 ? paletteColorAt(ctx, 0) : paletteColorAt(ctx, 1);
    }
    return phase === 0 ? '#ffffff' : '#000000';
}
