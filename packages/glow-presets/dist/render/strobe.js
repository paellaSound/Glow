export function renderStrobe(ctx) {
    const t = ctx.timeMs / 1000;
    return Math.floor(t * 8) % 2 === 0 ? '#ffffff' : '#ff0055';
}
