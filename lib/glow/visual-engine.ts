'use client';

import { useEffect, useRef, useState } from 'react';
import {
  computeDistributionColor,
  computeFallbackColor,
  computePresetColor,
  previewDeviceKey,
} from './presets';
import { useAudioAnalyzer } from './audio-analyzer';
import type {
  EffectDistribution,
  FallbackModeEvent,
  VisualAudioFeaturesEvent,
  VisualColorEvent,
  VisualPresetEvent,
  VisualMediaEvent,
} from './types';

type VisualEngineOptions = {
  roomCode?: string;
  devicePublicId?: string;
  row?: number;
  col?: number;
  matrixRows?: number;
  matrixCols?: number;
  onIdentify?: (label: string) => void;
};

/**
 * Device render priority (highest wins):
 * 1. identify flash (device:identify) — play page forces #ffffff while identifying
 * 2. media layer (visual:media) — hook via mediaActiveRef [future, feature 06]
 * 3. torch override (device:torch) — physical LED only, parallel to screen [future, feature 08]
 * 4. effect distribution / preset (visual:effect_distribution or visual:preset)
 * 5. direct color (visual:color)
 * 6. fallback mode (fallback:mode_changed)
 * 7. black / idle (#111111)
 */
const IDLE_COLOR = '#111111';

function usesLocalAudioFromPreset(preset: VisualPresetEvent | null): boolean {
  return preset?.presetId === 'audio' && preset.params?.audioSource !== 'orchestrator';
}

function usesLocalAudioFromDistribution(distribution: EffectDistribution | null): boolean {
  return (
    distribution?.effects.some(
      (effect) => effect.presetId === 'audio' && effect.params?.audioSource !== 'orchestrator'
    ) ?? false
  );
}

function resolveAudioFeatures(
  preset: VisualPresetEvent | null,
  distribution: EffectDistribution | null,
  orchestratorAudio: VisualAudioFeaturesEvent['features'] | null,
  localAudio: VisualAudioFeaturesEvent['features'] | undefined
): VisualAudioFeaturesEvent['features'] | undefined {
  const needsAudio =
    preset?.presetId === 'audio' ||
    distribution?.effects.some((effect) => effect.presetId === 'audio');

  if (!needsAudio) return undefined;

  const usesOrchestrator =
    preset?.params?.audioSource === 'orchestrator' ||
    distribution?.effects.some(
      (effect) =>
        effect.presetId === 'audio' && effect.params?.audioSource === 'orchestrator'
    );

  return usesOrchestrator ? (orchestratorAudio ?? undefined) : localAudio;
}

function resolveDeviceKey(options: VisualEngineOptions): string {
  if (options.devicePublicId) {
    return options.devicePublicId;
  }
  return previewDeviceKey(
    options.row ?? 0,
    options.col ?? 0,
    options.matrixCols ?? 1
  );
}

export function useVisualEngine(options: VisualEngineOptions) {
  const [color, setColor] = useState(IDLE_COLOR);
  const [identifying, setIdentifying] = useState(false);
  const [identifyLabel, setIdentifyLabel] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const fallbackRef = useRef<FallbackModeEvent | null>(null);
  const presetRef = useRef<VisualPresetEvent | null>(null);
  const effectDistributionRef = useRef<EffectDistribution | null>(null);
  const directColorRef = useRef<string | null>(null);
  /** Future hook: visual:media active payload [feature 06] */
  const mediaActiveRef = useRef<boolean>(false);
  const [activeMedia, setActiveMedia] = useState<VisualMediaEvent | null>(null);
  const orchestratorAudioRef = useRef<VisualAudioFeaturesEvent['features'] | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeMedia && activeMedia.durationMs && activeMedia.durationMs > 0) {
      const elapsed = Date.now() - activeMedia.timestamp;
      const remaining = activeMedia.durationMs - elapsed;
      if (remaining <= 0) {
        setActiveMedia(null);
        mediaActiveRef.current = false;
      } else {
        const timer = setTimeout(() => {
          setActiveMedia(null);
          mediaActiveRef.current = false;
        }, remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [activeMedia]);

  const audioAnalyzer = useAudioAnalyzer({ enabled: micEnabled });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setColor(resolveScreenColor(now));
      rafRef.current = requestAnimationFrame(tick);
    };

    function resolveScreenColor(now: number): string {
      if (activeMedia && (activeMedia.kind === 'image' || activeMedia.kind === 'gif')) {
        return '#000000';
      }

      const distribution = effectDistributionRef.current;
      if (distribution) {
        const elapsed = now - distribution.targetTimestamp;
        if (elapsed >= 0) {
          const audio = resolveAudioFeatures(
            null,
            distribution,
            orchestratorAudioRef.current,
            audioAnalyzer.featuresRef.current
          );
          return computeDistributionColor(
            distribution,
            {
              row: options.row ?? 0,
              col: options.col ?? 0,
              timeMs: elapsed,
              audio,
            },
            resolveDeviceKey(options)
          );
        }
      }

      const preset = presetRef.current;
      if (preset) {
        const elapsed = now - preset.targetTimestamp;
        if (elapsed >= 0) {
          const audio = resolveAudioFeatures(
            preset,
            null,
            orchestratorAudioRef.current,
            audioAnalyzer.featuresRef.current
          );

          return computePresetColor(preset.presetId, {
            row: options.row ?? 0,
            col: options.col ?? 0,
            timeMs: elapsed,
            seed: preset.seedTimestamp,
            matrixRows: preset.matrix.rows,
            matrixCols: preset.matrix.cols,
            audio,
            palette: preset.params?.palette,
          });
        }
      }

      if (directColorRef.current) {
        return directColorRef.current;
      }

      if (fallbackRef.current?.enabled && options.roomCode) {
        return computeFallbackColor(
          fallbackRef.current.roomCode,
          fallbackRef.current.seedTimestamp,
          options.row ?? 0,
          options.col ?? 0,
          now
        );
      }

      return IDLE_COLOR;
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    options.roomCode,
    options.devicePublicId,
    options.row,
    options.col,
    options.matrixRows,
    options.matrixCols,
    audioAnalyzer.featuresRef,
    activeMedia,
  ]);

  function scheduleColor(event: VisualColorEvent) {
    effectDistributionRef.current = null;
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
    effectDistributionRef.current = null;
    directColorRef.current = null;
    presetRef.current = event;
    orchestratorAudioRef.current = null;
    setMicEnabled(usesLocalAudioFromPreset(event));
  }

  function scheduleEffectDistribution(event: EffectDistribution) {
    presetRef.current = null;
    directColorRef.current = null;
    effectDistributionRef.current = event;
    orchestratorAudioRef.current = null;
    setMicEnabled(usesLocalAudioFromDistribution(event));
  }

  function setFallbackMode(event: FallbackModeEvent) {
    fallbackRef.current = event;
    if (!event.enabled) {
      presetRef.current = null;
      effectDistributionRef.current = null;
      setMicEnabled(false);
    } else {
      directColorRef.current = null;
      presetRef.current = null;
      effectDistributionRef.current = null;
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
    scheduleEffectDistribution,
    scheduleMedia(event: VisualMediaEvent) {
      if (event.kind === 'clear') {
        setActiveMedia(null);
        mediaActiveRef.current = false;
      } else {
        setActiveMedia(event);
        mediaActiveRef.current = true;
      }
    },
    clearMedia() {
      setActiveMedia(null);
      mediaActiveRef.current = false;
    },
    setFallbackMode,
    setAudioFeatures,
    triggerIdentify,
    setColor,
    activeMedia,
  };
}
