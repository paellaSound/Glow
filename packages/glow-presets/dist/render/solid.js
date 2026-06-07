import { paletteColorForCell } from '../utils/palette.js';
export function renderSolid(ctx) {
    if (ctx.palette?.length) {
        return paletteColorForCell(ctx);
    }
    return '#ff0055';
}
