'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import type { TorchCapability } from '@/lib/glow/types';

type PlayerFlashPermissionPromptProps = {
  open: boolean;
  showFlashButton: boolean;
  torchCapability: TorchCapability;
  torchEnabling: boolean;
  torchError: string | null;
  onEnable: () => Promise<TorchCapability>;
  onDismiss: () => void;
};

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '');
}

export function PlayerFlashPermissionPrompt({
  open,
  showFlashButton,
  torchCapability,
  torchEnabling,
  torchError,
  onEnable,
  onDismiss,
}: PlayerFlashPermissionPromptProps) {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());
  }, []);

  if (!open || torchCapability.enabled) return null;

  async function handleEnable() {
    if (isIOS) {
      onDismiss();
      return;
    }
    await onEnable();
  }

  return (
    <div className="dark absolute inset-0 z-30 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <NeonCard glowColor="cyan" borderVariant="cyan" className="w-full max-w-sm p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10">
            <Zap className="size-5 text-neon-cyan" />
          </div>
          <div className="min-w-0 flex-1">
            <NeonTitle as="h3" color="cyan" className="text-lg font-black tracking-widest">
              {isIOS ? 'FLASH EFFECTS' : 'ENABLE FLASH?'}
            </NeonTitle>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {isIOS
                ? 'When the DJ triggers strobe effects, your screen will flash. No camera access needed on iPhone.'
                : 'Allow camera access so your phone LED can blink during rave effects from the DJ.'}
            </p>
            {showFlashButton ? (
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                You can also hold the Flash button bottom-right anytime.
              </p>
            ) : null}
            {isIOS ? (
              <p className="mt-2 text-[10px] italic leading-relaxed text-amber-300/80">
                iOS Safari does not support hardware LED control.
              </p>
            ) : null}
            {torchError ? (
              <p className="mt-2 text-[10px] text-amber-300">{torchError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <NeonButton
            type="button"
            color="cyan"
            variant="outline"
            className="flex-1 text-xs uppercase tracking-widest h-10"
            onClick={onDismiss}
            disabled={torchEnabling}
          >
            Not now
          </NeonButton>
          <NeonButton
            type="button"
            color="cyan"
            variant="solid"
            className="flex-1 text-xs uppercase tracking-widest h-10"
            onClick={() => void handleEnable()}
            disabled={torchEnabling}
          >
            {torchEnabling ? 'Enabling…' : isIOS ? 'Got it' : 'Enable flash'}
          </NeonButton>
        </div>
      </NeonCard>
    </div>
  );
}
