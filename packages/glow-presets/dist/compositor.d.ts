import type { EffectBlendMode, EffectLayer, EffectStack, PresetContext } from './types.js';
type Rgb = {
    r: number;
    g: number;
    b: number;
};
export declare function hexToRgb(hex: string): Rgb;
export declare function rgbToHex({ r, g, b }: Rgb): string;
export declare function compositeColors(baseHex: string | null, overlayHex: string, blend: EffectBlendMode, opacity: number): string;
export declare function computeLayerColor(layer: EffectLayer, ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>, stack: Pick<EffectStack, 'seedTimestamp' | 'matrix'>): string;
export declare function computeEffectStackColor(stack: EffectStack, ctx: Pick<PresetContext, 'row' | 'col' | 'timeMs' | 'audio'>): string;
export {};
