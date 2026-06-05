export function renderPulse(ctx) {
    const t = ctx.timeMs / 1000;
    const pulse = (Math.sin(t * 4) + 1) / 2;
    const v = Math.round(pulse * 255);
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
}
