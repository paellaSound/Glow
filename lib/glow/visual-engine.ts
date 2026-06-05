'use client';

import { useEffect, useRef, useState } from 'react';
import {
  computeFallbackColor,
  computePresetColor,
  type PresetContext,
} from './presets';
import type {
  FallbackModeEvent,
  VisualColorEvent,
  VisualPresetEvent,
} from './types';

type VisualEngineOptions = {
  roomCode?: string;
  row?: number;
  col?: number;
  matrixRows?: number;
  matrixCols?: number;
  onIdentify?: (label: string) => void;
};

export function useVisualEngine(options: VisualEngineOptions) {
  const [color, setColor] = useState('#111111');
  const [identifying, setIdentifying] = useState(false);
  const [identifyLabel, setIdentifyLabel] = useState<string | null>(null);
  const fallbackRef = useRef<FallbackModeEvent | null>(null);
  const presetRef = useRef<VisualPresetEvent | null>(null);
  const directColorRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      if (fallbackRef.current?.enabled && options.roomCode) {
        const c = computeFallbackColor(
          fallbackRef.current.roomCode,
          fallbackRef.current.seedTimestamp,
          options.row ?? 0,
          options.col ?? 0,
          now
        );
        setColor(c);
      } else if (directColorRef.current) {
        setColor(directColorRef.current);
      } else if (presetRef.current) {
        const preset = presetRef.current;
        const elapsed = now - preset.targetTimestamp;
        if (elapsed >= 0) {
          const ctx: PresetContext = {
            row: options.row ?? 0,
            col: options.col ?? 0,
            timeMs: elapsed,
            seed: preset.seedTimestamp,
            matrixRows: preset.matrix.rows,
            matrixCols: preset.matrix.cols,
          };
          setColor(computePresetColor(preset.presetId, ctx));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [options.roomCode, options.row, options.col]);

  function scheduleColor(event: VisualColorEvent) {
    presetRef.current = null;
    const delay = Math.max(0, event.targetTimestamp - Date.now());
    window.setTimeout(() => {
      directColorRef.current = event.colorHex;
      setColor(event.colorHex);
    }, delay);
  }

  function schedulePreset(event: VisualPresetEvent) {
    directColorRef.current = null;
    presetRef.current = event;
  }

  function setFallbackMode(event: FallbackModeEvent) {
    fallbackRef.current = event;
    if (!event.enabled) {
      presetRef.current = null;
    } else {
      directColorRef.current = null;
    }
  }

  function triggerIdentify(label: string) {
    setIdentifying(true);
    setIdentifyLabel(label);
    options.onIdentify?.(label);
    window.setTimeout(() => {
      setIdentifying(false);
      setIdentifyLabel(null);
    }, 3000);
  }

  return {
    color,
    identifying,
    identifyLabel,
    scheduleColor,
    schedulePreset,
    setFallbackMode,
    triggerIdentify,
    setColor,
  };
}
