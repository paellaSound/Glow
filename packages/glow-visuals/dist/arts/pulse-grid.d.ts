/**
 * pulse-grid — Plus 25+ visual art.
 *
 * A Canvas2D grid of cells that pulse between the palette colours.
 * Each cell has an independent phase offset so the wave rolls across the grid.
 * Reacts to audio bass when available (cell brightness driven by bass energy).
 */
import type { VisualArtController, VisualArtInput } from '../types.js';
export declare function mountPulseGrid(canvas: HTMLCanvasElement, getInput: () => VisualArtInput): VisualArtController;
