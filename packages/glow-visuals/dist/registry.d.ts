import type { VisualArtDefinition, VisualArtId } from './types.js';
export declare const VISUAL_ART_REGISTRY: Record<VisualArtId, VisualArtDefinition>;
/** Return all art IDs accessible at `planCode`. */
export declare function visualArtsForPlan(planCode: string): VisualArtId[];
export declare function getVisualArt(id: string): VisualArtDefinition | undefined;
export declare function isValidVisualArtId(id: string): id is VisualArtId;
export declare const VISUAL_ART_LABELS: Record<VisualArtId, string>;
