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
import type { VisualArtController, VisualArtInput } from '../types.js';
export declare function mountGlowBranded(canvas: HTMLCanvasElement, getInput: () => VisualArtInput): VisualArtController;
