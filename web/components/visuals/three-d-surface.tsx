'use client';

/**
 * 3D Visuals mode base layer — mounts the glow-visuals-3d energy orb.
 *
 * The package (and three.js) is lazy-imported so it lands in its own chunk
 * and never weighs on the main visuals bundle. Audio/palette flow in through
 * `inputRef` (same per-frame pull pattern as the 2D arts); energy level and
 * one-shot actions arrive as props driven by visuals:3d socket events.
 */

import { useEffect, useRef, useState } from 'react';
import type { Visuals3DController, Visuals3DInput, OrbAction } from 'glow-visuals-3d';

export type ThreeDAction = { action: OrbAction; nonce: number } | null;

export function ThreeDSurface({
  inputRef,
  energy,
  pendingAction,
}: {
  inputRef: React.MutableRefObject<Visuals3DInput>;
  energy: number;
  pendingAction: ThreeDAction;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<Visuals3DController | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('glow-visuals-3d')
      .then(({ mountEnergyOrb }) => {
        if (cancelled || !canvasRef.current || controllerRef.current) return;
        controllerRef.current = mountEnergyOrb(canvasRef.current, () => inputRef.current);
      })
      .catch((err) => {
        console.error('[visuals-3d] failed to load renderer:', err);
        setLoadError(true);
      });

    const handler = () => controllerRef.current?.resize();
    window.addEventListener('resize', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handler);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [inputRef]);

  useEffect(() => {
    controllerRef.current?.setEnergy(energy);
  }, [energy]);

  useEffect(() => {
    if (pendingAction) {
      controllerRef.current?.triggerAction(pendingAction.action);
    }
  }, [pendingAction]);

  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-600">
          3D renderer unavailable
        </p>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ display: 'block' }} />;
}
