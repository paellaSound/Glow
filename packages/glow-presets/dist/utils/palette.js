const DEFAULT_PALETTE = ['#ff0055', '#00ffcc', '#0055ff'];
export function resolvePalette(ctx) {
    if (ctx.palette && ctx.palette.length > 0) {
        return ctx.palette;
    }
    return DEFAULT_PALETTE;
}
export function paletteColorAt(ctx, index) {
    const palette = resolvePalette(ctx);
    return palette[((index % palette.length) + palette.length) % palette.length];
}
export function paletteColorForCell(ctx) {
    const index = ctx.row * ctx.matrixCols + ctx.col;
    return paletteColorAt(ctx, index);
}
