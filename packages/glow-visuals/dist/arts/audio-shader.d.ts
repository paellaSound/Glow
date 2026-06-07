/**
 * audio-shader — Plus 25+ visual art.
 *
 * WebGL fragment shader ported from web/visual_arts/indext.html.
 * The hardcoded neon cyan/magenta palette is replaced with uniforms
 * driven by the active palette colours.
 *
 * Falls back to an offline sine-wave simulation when no audio data arrives,
 * so the surface is never blank.
 */
import type { VisualArtController, VisualArtInput } from '../types.js';
export declare function mountAudioShader(canvas: HTMLCanvasElement, getInput: () => VisualArtInput): VisualArtController;
