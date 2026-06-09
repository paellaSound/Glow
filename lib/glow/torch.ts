'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceTorchEvent, TorchCapability, TorchCommand } from '@/lib/glow/types';

/** Max single pulse duration */
export const TORCH_MAX_PULSE_MS = 2000;
/** Max on/off interval per strobe step */
export const TORCH_MAX_INTERVAL_MS = 500;
/** Max cycles in a pattern command */
export const TORCH_MAX_CYCLES = 50;
/** Max total pattern duration per command */
export const TORCH_MAX_PATTERN_TOTAL_MS = 5000;
/** Cooldown after a long pattern before the next pattern */
export const TORCH_COOLDOWN_MS = 1500;
/** Release camera stream after idle period */
export const TORCH_IDLE_RELEASE_MS = 5 * 60 * 1000;

type TorchTrackCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePulseCommand(command: Extract<TorchCommand, { action: 'pulse' }>): Extract<TorchCommand, { action: 'pulse' }> {
  return {
    action: 'pulse',
    durationMs: clamp(command.durationMs, 50, TORCH_MAX_PULSE_MS),
  };
}

function normalizePatternCommand(
  command: Extract<TorchCommand, { action: 'pattern' }>
): Extract<TorchCommand, { action: 'pattern' }> {
  const onMs = clamp(command.onMs, 50, TORCH_MAX_INTERVAL_MS);
  const offMs = clamp(command.offMs, 50, TORCH_MAX_INTERVAL_MS);
  const maxCycles = Math.floor(TORCH_MAX_PATTERN_TOTAL_MS / (onMs + offMs));
  const cycles = clamp(command.cycles, 1, Math.min(TORCH_MAX_CYCLES, maxCycles));
  return { action: 'pattern', onMs, offMs, cycles };
}

function normalizeHoldCommand(
  command: Extract<TorchCommand, { action: 'hold' }>
): Extract<TorchCommand, { action: 'hold' }> {
  if (command.mode === 'pulse') return command;
  return {
    action: 'hold',
    mode: 'strobe',
    onMs: clamp(command.onMs, 50, TORCH_MAX_INTERVAL_MS),
    offMs: clamp(command.offMs, 50, TORCH_MAX_INTERVAL_MS),
  };
}

function normalizeCommand(command: TorchCommand): TorchCommand {
  if (command.action === 'hold') return normalizeHoldCommand(command);
  if (command.action === 'pulse') return normalizePulseCommand(command);
  if (command.action === 'pattern') return normalizePatternCommand(command);
  return command;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useTorch(options?: { clockOffset?: number }) {
  const clockOffset = options?.clockOffset ?? 0;
  const [capability, setCapability] = useState<TorchCapability>({ supported: false, enabled: false });
  const [torchActive, setTorchActive] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const capabilityRef = useRef<TorchCapability>(capability);
  const scheduleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const patternTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idleReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownUntilRef = useRef(0);
  const commandGenerationRef = useRef(0);
  const manualHoldRef = useRef(false);
  const remoteHoldRef = useRef(false);
  const strobeHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualHoldActive, setManualHoldActive] = useState(false);

  useEffect(() => {
    capabilityRef.current = capability;
  }, [capability]);

  const clearScheduleTimers = useCallback(() => {
    for (const timer of scheduleTimersRef.current) {
      clearTimeout(timer);
    }
    scheduleTimersRef.current = [];
  }, []);

  const clearPatternTimers = useCallback(() => {
    for (const timer of patternTimersRef.current) {
      clearTimeout(timer);
    }
    patternTimersRef.current = [];
  }, []);

  const bumpCommandGeneration = useCallback(() => {
    commandGenerationRef.current += 1;
    clearPatternTimers();
  }, [clearPatternTimers]);

  const setHardwareTorch = useCallback(async (on: boolean): Promise<boolean> => {
    const track = trackRef.current;
    if (!track) return false;

    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as TorchConstraintSet],
      });
      setTorchActive(on);
      return true;
    } catch {
      setTorchActive(false);
      return false;
    }
  }, []);

  const setScreenFlashState = useCallback((active: boolean) => {
    setScreenFlash(active);
  }, []);

  const disableTorchRef = useRef<() => Promise<void>>(async () => {});

  const resetIdleReleaseTimer = useCallback(() => {
    if (idleReleaseTimerRef.current) {
      clearTimeout(idleReleaseTimerRef.current);
    }
    idleReleaseTimerRef.current = setTimeout(() => {
      void disableTorchRef.current();
    }, TORCH_IDLE_RELEASE_MS);
  }, []);

  const setFlashState = useCallback(
    (on: boolean) => {
      const cap = capabilityRef.current;
      if (cap.supported && cap.enabled && trackRef.current) {
        void setHardwareTorch(on);
        return;
      }
      setScreenFlashState(on);
    },
    [setHardwareTorch, setScreenFlashState]
  );

  const stopRemoteHold = useCallback(() => {
    remoteHoldRef.current = false;
    if (strobeHoldTimerRef.current) {
      clearTimeout(strobeHoldTimerRef.current);
      strobeHoldTimerRef.current = null;
    }
    void setHardwareTorch(false);
    setScreenFlashState(false);
  }, [setHardwareTorch, setScreenFlashState]);

  const startRemoteHold = useCallback(
    (command: Extract<TorchCommand, { action: 'hold' }>) => {
      bumpCommandGeneration();
      remoteHoldRef.current = true;

      if (idleReleaseTimerRef.current) {
        clearTimeout(idleReleaseTimerRef.current);
        idleReleaseTimerRef.current = null;
      }

      const generation = commandGenerationRef.current;

      if (command.mode === 'pulse') {
        setFlashState(true);
        return;
      }

      let isOn = true;
      setFlashState(true);

      const tick = () => {
        if (!remoteHoldRef.current || generation !== commandGenerationRef.current) return;
        isOn = !isOn;
        setFlashState(isOn);
        strobeHoldTimerRef.current = setTimeout(tick, isOn ? command.onMs : command.offMs);
      };

      strobeHoldTimerRef.current = setTimeout(tick, command.onMs);
    },
    [bumpCommandGeneration, setFlashState]
  );

  const releaseStream = useCallback(async () => {
    manualHoldRef.current = false;
    setManualHoldActive(false);
    stopRemoteHold();
    bumpCommandGeneration();
    clearScheduleTimers();
    clearPatternTimers();
    await setHardwareTorch(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      trackRef.current = null;
    }

    setTorchActive(false);
    setScreenFlash(false);
  }, [bumpCommandGeneration, clearPatternTimers, clearScheduleTimers, setHardwareTorch, stopRemoteHold]);

  const disableTorch = useCallback(async () => {
    if (idleReleaseTimerRef.current) {
      clearTimeout(idleReleaseTimerRef.current);
      idleReleaseTimerRef.current = null;
    }

    await releaseStream();
    setCapability((prev) => ({ supported: prev.supported, enabled: false }));
    setError(null);
  }, [releaseStream]);

  useEffect(() => {
    disableTorchRef.current = disableTorch;
  }, [disableTorch]);

  const requestEnable = useCallback(async (): Promise<TorchCapability> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const result = { supported: false, enabled: false };
      setCapability(result);
      setError('Camera access is not available on this device.');
      return result;
    }

    setEnabling(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        const result = { supported: false, enabled: false };
        setCapability(result);
        setError('No camera track available.');
        return result;
      }

      const caps = track.getCapabilities() as TorchTrackCapabilities;
      const supported = caps.torch === true;

      if (!supported) {
        stream.getTracks().forEach((t) => t.stop());
        const result = { supported: false, enabled: false };
        setCapability(result);
        setError('This device does not support LED flash control. Screen flash fallback will be used.');
        return result;
      }

      streamRef.current = stream;
      trackRef.current = track;
      const result = { supported: true, enabled: true };
      setCapability(result);
      resetIdleReleaseTimer();
      return result;
    } catch {
      const result = { supported: false, enabled: false };
      setCapability(result);
      setError('Camera permission was denied. Enable flash effects requires camera access.');
      return result;
    } finally {
      setEnabling(false);
    }
  }, [resetIdleReleaseTimer]);

  const runHardwareCommand = useCallback(
    async (command: TorchCommand, generation: number) => {
      if (generation !== commandGenerationRef.current) return;

      if (command.action === 'on') {
        await setHardwareTorch(true);
        return;
      }

      if (command.action === 'off') {
        await setHardwareTorch(false);
        return;
      }

      if (command.action === 'pulse') {
        await setHardwareTorch(true);
        await delay(command.durationMs);
        if (generation !== commandGenerationRef.current) return;
        await setHardwareTorch(false);
        return;
      }

      if (command.action === 'pattern') {
        for (let cycle = 0; cycle < command.cycles; cycle += 1) {
          if (generation !== commandGenerationRef.current) return;
          await setHardwareTorch(true);
          await delay(command.onMs);
          if (generation !== commandGenerationRef.current) return;
          await setHardwareTorch(false);
          if (cycle < command.cycles - 1) {
            await delay(command.offMs);
          }
        }
        cooldownUntilRef.current = Date.now() + TORCH_COOLDOWN_MS;
      }
    },
    [setHardwareTorch]
  );

  const runScreenFlashFallback = useCallback(
    (command: TorchCommand, generation: number) => {
      if (generation !== commandGenerationRef.current) return;

      const flashOn = () => setScreenFlashState(true);
      const flashOff = () => setScreenFlashState(false);

      if (command.action === 'on') {
        flashOn();
        return;
      }

      if (command.action === 'off') {
        flashOff();
        return;
      }

      if (command.action === 'pulse') {
        flashOn();
        const offTimer = setTimeout(() => {
          if (generation !== commandGenerationRef.current) return;
          flashOff();
        }, command.durationMs);
        patternTimersRef.current.push(offTimer);
        return;
      }

      if (command.action === 'pattern') {
        let elapsed = 0;
        for (let cycle = 0; cycle < command.cycles; cycle += 1) {
          const onAt = elapsed;
          elapsed += command.onMs;
          const offAt = elapsed;
          elapsed += command.offMs;

          const onTimer = setTimeout(() => {
            if (generation !== commandGenerationRef.current) return;
            flashOn();
          }, onAt);
          const offTimer = setTimeout(() => {
            if (generation !== commandGenerationRef.current) return;
            flashOff();
          }, offAt);
          patternTimersRef.current.push(onTimer, offTimer);
        }
        cooldownUntilRef.current = Date.now() + TORCH_COOLDOWN_MS;
      }
    },
    [setScreenFlashState]
  );

  const startManualFlash = useCallback(() => {
    if (manualHoldRef.current) return;

    manualHoldRef.current = true;
    setManualHoldActive(true);
    bumpCommandGeneration();

    if (idleReleaseTimerRef.current) {
      clearTimeout(idleReleaseTimerRef.current);
      idleReleaseTimerRef.current = null;
    }

    const cap = capabilityRef.current;
    if (cap.supported && cap.enabled && trackRef.current) {
      void setHardwareTorch(true);
      return;
    }

    setScreenFlashState(true);
  }, [bumpCommandGeneration, setHardwareTorch, setScreenFlashState]);

  const stopManualFlash = useCallback(() => {
    if (!manualHoldRef.current) return;

    manualHoldRef.current = false;
    setManualHoldActive(false);

    void setHardwareTorch(false);
    setScreenFlashState(false);

    if (capabilityRef.current.enabled) {
      resetIdleReleaseTimer();
    }
  }, [resetIdleReleaseTimer, setHardwareTorch, setScreenFlashState]);

  const executeCommand = useCallback(
    (rawCommand: TorchCommand) => {
      const command = normalizeCommand(rawCommand);

      if (command.action === 'off') {
        stopRemoteHold();
        if (capabilityRef.current.enabled) {
          resetIdleReleaseTimer();
        }
        return;
      }

      if (manualHoldRef.current) return;

      if (command.action === 'hold') {
        startRemoteHold(command);
        return;
      }

      const generation = commandGenerationRef.current;
      const cap = capabilityRef.current;

      resetIdleReleaseTimer();

      if (command.action === 'pattern' && Date.now() < cooldownUntilRef.current) {
        return;
      }

      if (cap.supported && cap.enabled && trackRef.current) {
        void runHardwareCommand(command, generation);
      } else {
        runScreenFlashFallback(command, generation);
      }
    },
    [
      resetIdleReleaseTimer,
      runHardwareCommand,
      runScreenFlashFallback,
      startRemoteHold,
      stopRemoteHold,
    ]
  );

  const scheduleCommand = useCallback(
    (event: DeviceTorchEvent) => {
      const delayMs = Math.max(0, event.targetTimestamp - (Date.now() + clockOffset));
      const timer = setTimeout(() => {
        executeCommand(event.command);
      }, delayMs);
      scheduleTimersRef.current.push(timer);
      resetIdleReleaseTimer();
    },
    [executeCommand, resetIdleReleaseTimer, clockOffset]
  );

  useEffect(() => {
    return () => {
      manualHoldRef.current = false;
      stopRemoteHold();
      clearScheduleTimers();
      clearPatternTimers();
      if (idleReleaseTimerRef.current) {
        clearTimeout(idleReleaseTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [clearPatternTimers, clearScheduleTimers, stopRemoteHold]);

  return {
    capability,
    torchActive,
    screenFlash,
    manualHoldActive,
    enabling,
    error,
    requestEnable,
    disableTorch,
    startManualFlash,
    stopManualFlash,
    scheduleCommand,
    executeCommand,
  };
}
