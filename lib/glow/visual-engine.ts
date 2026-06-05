'use client';

import { useEffect, useRef, useState } from 'react';
import { computeFallbackColor, computePresetColor } from './presets';
import { useAudioAnalyzer } from './audio-analyzer';
import type {
  FallbackModeEvent,
  VisualAudioFeaturesEvent,
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

function usesLocalAudio(preset: VisualPresetEvent | null): boolean {
  return preset?.presetId === 'audio' && preset.params?.audioSource !== 'orchestrator';
}

export function useVisualEngine(options: VisualEngineOptions) {
  const [color, setColor] = useState('#111111');
  const [identifying, setIdentifying] = useState(false);
  const [identifyLabel, setIdentifyLabel] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const fallbackRef = useRef<FallbackModeEvent | null>(null);
  const presetRef = useRef<VisualPresetEvent | null>(null);
  const directColorRef = useRef<string | null>(null);
  const orchestratorAudioRef = useRef<VisualAudioFeaturesEvent['features'] | null>(null);
  const rafRef = useRef<number | null>(null);

  const audioAnalyzer = useAudioAnalyzer({ enabled: micEnabled });

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
          const audio =
            preset.presetId === 'audio'
              ? preset.params?.audioSource === 'orchestrator'
                ? (orchestratorAudioRef.current ?? undefined)
                : audioAnalyzer.featuresRef.current
              : undefined;

          setColor(
            computePresetColor(preset.presetId, {
              row: options.row ?? 0,
              col: options.col ?? 0,
              timeMs: elapsed,
              seed: preset.seedTimestamp,
              matrixRows: preset.matrix.rows,
              matrixCols: preset.matrix.cols,
              audio,
            })
          );
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    options.roomCode,
    options.row,
    options.col,
    options.matrixRows,
    options.matrixCols,
    audioAnalyzer.featuresRef,
  ]);

  function scheduleColor(event: VisualColorEvent) {
    presetRef.current = null;
    setMicEnabled(false);
    orchestratorAudioRef.current = null;
    const delay = Math.max(0, event.targetTimestamp - Date.now());
    window.setTimeout(() => {
      directColorRef.current = event.colorHex;
      setColor(event.colorHex);
    }, delay);
  }

  function schedulePreset(event: VisualPresetEvent) {
    directColorRef.current = null;
    presetRef.current = event;
    orchestratorAudioRef.current = null;
    setMicEnabled(usesLocalAudio(event));
  }

  function setFallbackMode(event: FallbackModeEvent) {
    fallbackRef.current = event;
    if (!event.enabled) {
      presetRef.current = null;
      setMicEnabled(false);
    } else {
      directColorRef.current = null;
      orchestratorAudioRef.current = null;
      setMicEnabled(false);
    }
  }

  function setAudioFeatures(event: VisualAudioFeaturesEvent) {
    orchestratorAudioRef.current = event.features;
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
    micActive: audioAnalyzer.active,
    micError: audioAnalyzer.error,
    scheduleColor,
    schedulePreset,
    setFallbackMode,
    setAudioFeatures,
    triggerIdentify,
    setColor,
  };
}
