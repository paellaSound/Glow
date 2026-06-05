'use client';

import { useEffect, useRef, useState } from 'react';
import type { AudioFeatures } from 'glow-presets';

export const DEFAULT_AUDIO_FEATURES: AudioFeatures = {
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
};

export function extractAudioFeatures(
  analyser: AnalyserNode,
  buffer: Uint8Array<ArrayBuffer>
): AudioFeatures {
  analyser.getByteFrequencyData(buffer);
  const binCount = buffer.length;
  const bassEnd = Math.max(1, Math.floor(binCount * 0.1));
  const midEnd = Math.max(bassEnd + 1, Math.floor(binCount * 0.5));

  let bass = 0;
  let mid = 0;
  let treble = 0;
  let total = 0;

  for (let i = 0; i < binCount; i++) {
    const value = buffer[i] / 255;
    total += value;
    if (i < bassEnd) {
      bass += value;
    } else if (i < midEnd) {
      mid += value;
    } else {
      treble += value;
    }
  }

  return {
    bass: bass / bassEnd,
    mid: mid / (midEnd - bassEnd),
    treble: treble / (binCount - midEnd),
    energy: total / binCount,
  };
}

type UseAudioAnalyzerOptions = {
  enabled: boolean;
};

export function useAudioAnalyzer({ enabled }: UseAudioAnalyzerOptions) {
  const [features, setFeatures] = useState<AudioFeatures>(DEFAULT_AUDIO_FEATURES);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const featuresRef = useRef<AudioFeatures>(DEFAULT_AUDIO_FEATURES);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      setError(null);
      featuresRef.current = DEFAULT_AUDIO_FEATURES;
      setFeatures(DEFAULT_AUDIO_FEATURES);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();
        await audioContext.resume();

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.frequencyBinCount);

        if (cancelled) {
          return;
        }

        setActive(true);
        setError(null);

        const tick = () => {
          const next = extractAudioFeatures(analyser, buffer);
          featuresRef.current = next;
          setFeatures(next);
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setError('Microphone access denied');
          setActive(false);
          featuresRef.current = DEFAULT_AUDIO_FEATURES;
          setFeatures(DEFAULT_AUDIO_FEATURES);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [enabled]);

  return { features, featuresRef, active, error };
}
