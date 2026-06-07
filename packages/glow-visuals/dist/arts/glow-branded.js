/**
 * glow-branded — Free-tier visual art.
 *
 * A full-screen branded Canvas2D splash that:
 *  - Fills the background with an animated gradient built from the active palette.
 *  - Displays "Glow the Rave" as a large centred logo.
 *  - Shows the room code and a "Join at glow.rave" CTA (acts as passive viral marketing).
 *  - Subtly pulses brightness with a sine wave (no audio required).
 *
 * Free users get this instead of a blank screen, which means the surface is still
 * useful for them and promotes the brand at their events.
 */
function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const full = clean.length === 3
        ? clean.split('').map((c) => c + c).join('')
        : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mountGlowBranded(canvas, getInput) {
    const ctx = canvas.getContext('2d');
    let rafId = 0;
    let startTime = performance.now();
    function resize() {
        canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
        canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    }
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }
    function render(nowMs) {
        const input = getInput();
        const t = (nowMs - startTime) / 1000;
        const w = canvas.width;
        const h = canvas.height;
        const dpr = window.devicePixelRatio || 1;
        // --- Background gradient from palette ---
        const palette = input.palette.length > 0 ? input.palette : ['#7c3aed', '#06b6d4'];
        const col0 = hexToRgb(palette[0]);
        const col1 = hexToRgb(palette[palette.length > 1 ? 1 : 0]);
        // Slow oscillation between the two colours
        const mix = Math.sin(t * 0.3) * 0.5 + 0.5;
        const r = Math.round(lerp(col0[0], col1[0], mix));
        const g = Math.round(lerp(col0[1], col1[1], mix));
        const b = Math.round(lerp(col0[2], col1[2], mix));
        // Radial gradient — bright centre, dark edges
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        grad.addColorStop(1, `rgba(0,0,0,0.95)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        // --- Subtle grid overlay ---
        const gridAlpha = 0.06 + 0.03 * Math.sin(t * 0.5);
        ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
        ctx.lineWidth = 1;
        const cell = Math.round(80 * dpr);
        for (let x = 0; x < w; x += cell) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += cell) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        // --- Logo text ---
        const pulse = 0.92 + 0.08 * Math.sin(t * 1.8);
        const logoSize = Math.round(Math.min(w, h) * 0.11 * pulse);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Glow effect
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.shadowBlur = 40 * dpr;
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${logoSize}px -apple-system, "Inter", "Helvetica Neue", sans-serif`;
        ctx.fillText('GLOW THE RAVE', w / 2, h * 0.42);
        // Sub-tagline
        ctx.shadowBlur = 0;
        const subSize = Math.round(logoSize * 0.28);
        ctx.font = `400 ${subSize}px -apple-system, "Inter", "Helvetica Neue", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('Make your crowd glow', w / 2, h * 0.42 + logoSize * 0.85);
        ctx.restore();
        // --- Room code / CTA ---
        const roomCode = input.roomCode;
        const ctaSize = Math.round(Math.min(w, h) * 0.032);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${ctaSize}px -apple-system, "Inter", "Helvetica Neue", sans-serif`;
        if (roomCode) {
            // Room code badge
            const badgeW = ctaSize * 7;
            const badgeH = ctaSize * 1.6;
            const badgeX = w / 2 - badgeW / 2;
            const badgeY = h * 0.62 - badgeH / 2;
            const radius = badgeH * 0.3;
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText(`Room: ${roomCode}`, w / 2, h * 0.62);
        }
        // Join CTA
        ctx.font = `400 ${Math.round(ctaSize * 0.85)}px -apple-system, "Inter", "Helvetica Neue", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('Join at glotherave', w / 2, h * 0.72);
        ctx.restore();
        // --- Scan-line vignette ---
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);
        rafId = requestAnimationFrame(render);
    }
    resize();
    rafId = requestAnimationFrame(render);
    return {
        setInput: (_input) => { },
        resize,
        destroy: () => {
            cancelAnimationFrame(rafId);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
    };
}
