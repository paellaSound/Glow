'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Sparkles, X } from 'lucide-react';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VIDEO_URL,
  type OnboardingStepId,
} from '@/lib/onboarding/constants';
import { trackOnboardingStepCompleted } from '@/lib/onboarding/analytics';
import {
  persistChecklistDismissStatus,
  useOnboardingVisibility,
} from '@/lib/onboarding/use-onboarding-person-state';
import { cn } from '@/lib/utils';

type FirstPartyOnboardingProps = {
  roomCode: string;
  deviceCount: number;
  hasRunPreset: boolean;
  visualsTabActive: boolean;
  shareAcknowledged?: boolean;
  onRequestVisualsTab?: () => void;
  onActiveStepChange?: (step: OnboardingStepId | null) => void;
};

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neon-cyan/20 text-neon-cyan">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-cyber font-bold',
        active
          ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
          : 'border-white/15 text-zinc-500'
      )}
    >
      ·
    </span>
  );
}

export function FirstPartyOnboarding({
  roomCode,
  deviceCount,
  hasRunPreset,
  visualsTabActive,
  shareAcknowledged = false,
  onRequestVisualsTab,
  onActiveStepChange,
}: FirstPartyOnboardingProps) {
  const { ready, visible: shouldShow, initialCompletedSteps } = useOnboardingVisibility();
  const [minimized, setMinimized] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStepId>>(() => new Set());
  const [dismissed, setDismissed] = useState(false);
  const trackedSteps = useRef<Set<OnboardingStepId>>(new Set());
  const hydratedFromPostHog = useRef(false);

  useEffect(() => {
    if (!ready || hydratedFromPostHog.current) return;
    hydratedFromPostHog.current = true;
    if (initialCompletedSteps.size > 0) {
      setCompletedSteps(new Set(initialCompletedSteps));
      initialCompletedSteps.forEach((step) => trackedSteps.current.add(step));
    }
  }, [ready, initialCompletedSteps]);

  const markStepComplete = useCallback(
    (step: OnboardingStepId) => {
      setCompletedSteps((prev) => {
        if (prev.has(step)) return prev;
        const next = new Set(prev);
        next.add(step);
        return next;
      });

      if (!trackedSteps.current.has(step)) {
        trackedSteps.current.add(step);
        trackOnboardingStepCompleted(step, roomCode, {
          deviceCount: step === 2 ? deviceCount : undefined,
        });
      }
    },
    [roomCode, deviceCount]
  );

  useEffect(() => {
    if (shareAcknowledged) {
      markStepComplete(1);
    }
  }, [shareAcknowledged, markStepComplete]);

  useEffect(() => {
    if (deviceCount >= 1) {
      markStepComplete(1);
      markStepComplete(2);
    }
  }, [deviceCount, markStepComplete]);

  useEffect(() => {
    if (hasRunPreset) {
      markStepComplete(3);
    }
  }, [hasRunPreset, markStepComplete]);

  useEffect(() => {
    if (visualsTabActive) {
      markStepComplete(4);
    }
  }, [visualsTabActive, markStepComplete]);

  const activeStep = useMemo((): OnboardingStepId | null => {
    for (const step of ONBOARDING_STEPS) {
      if (!completedSteps.has(step.id)) return step.id;
    }
    return null;
  }, [completedSteps]);

  useEffect(() => {
    onActiveStepChange?.(ready && shouldShow && !dismissed ? activeStep : null);
  }, [activeStep, onActiveStepChange, ready, shouldShow, dismissed]);

  const coreStepsDone = completedSteps.has(1) && completedSteps.has(2) && completedSteps.has(3);

  function dismiss(status: 'complete' | 'dismissed') {
    persistChecklistDismissStatus(status);
    setDismissed(true);
    onActiveStepChange?.(null);
  }

  function handleShareAction() {
    markStepComplete(1);
  }

  if (!ready || !shouldShow || dismissed) return null;

  const activeStepMeta = ONBOARDING_STEPS.find((s) => s.id === activeStep);

  return (
    <div
      className="fixed z-40 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-4 right-4 sm:left-auto sm:right-20 sm:max-w-sm"
      role="region"
      aria-label="First party onboarding"
    >
      <NeonCard
        glowColor="cyan"
        borderVariant="cyan"
        hoverEffect={false}
        className="overflow-hidden shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-neon-cyan" />
              <NeonTitle as="h2" color="cyan" className="text-xs font-black tracking-widest">
                First party checklist
              </NeonTitle>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {coreStepsDone
                ? 'Core steps done — optional Visuals setup below.'
                : 'Follow these steps to run your first Glow party.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={minimized ? 'Expand checklist' : 'Minimize checklist'}
              className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              onClick={() => setMinimized((v) => !v)}
            >
              {minimized ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <button
              type="button"
              aria-label="Dismiss onboarding"
              className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              onClick={() => dismiss('dismissed')}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {!minimized ? (
          <div className="px-4 py-3">
            <ol className="flex flex-col gap-2.5">
              {ONBOARDING_STEPS.map((step) => {
                const done = completedSteps.has(step.id);
                const active = activeStep === step.id;

                return (
                  <li
                    key={step.id}
                    className={cn(
                      'flex gap-3 rounded-lg px-2 py-2 transition-colors',
                      active && 'bg-neon-cyan/5 ring-1 ring-neon-cyan/20'
                    )}
                  >
                    <StepIcon done={done} active={active} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-xs font-cyber font-semibold tracking-wide',
                          done ? 'text-zinc-500 line-through' : 'text-foreground'
                        )}
                      >
                        {step.id}. {step.title}
                        {'optional' in step && step.optional ? (
                          <span className="ml-1 text-[10px] font-normal text-zinc-500">(optional)</span>
                        ) : null}
                      </p>
                      {active ? (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {activeStep === 1 && activeStepMeta ? (
              <NeonButton
                color="cyan"
                variant="outline"
                className="mt-3 h-8 w-full text-[10px] uppercase tracking-widest"
                onClick={handleShareAction}
              >
                I shared the link
              </NeonButton>
            ) : null}

            {activeStep === 4 ? (
              <div className="mt-3 flex flex-col gap-2">
                {onRequestVisualsTab ? (
                  <NeonButton
                    color="cyan"
                    variant="solid"
                    className="h-8 w-full text-[10px] uppercase tracking-widest"
                    onClick={onRequestVisualsTab}
                  >
                    Open Visuals tab
                  </NeonButton>
                ) : null}
                <NeonButton
                  color="cyan"
                  variant="ghost"
                  className="h-8 w-full text-[10px] uppercase tracking-widest"
                  onClick={() => dismiss('complete')}
                >
                  Skip for now
                </NeonButton>
              </div>
            ) : null}

            {coreStepsDone && activeStep !== 4 ? (
              <NeonButton
                color="cyan"
                variant="solid"
                className="mt-3 h-9 w-full text-[10px] uppercase tracking-widest"
                onClick={() => dismiss('complete')}
              >
                Finish tour
              </NeonButton>
            ) : null}

            {ONBOARDING_VIDEO_URL ? (
              <a
                href={ONBOARDING_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-cyber uppercase tracking-widest text-neon-cyan hover:underline"
              >
                Watch intro video
                <ExternalLink className="size-3" />
              </a>
            ) : null}

            <button
              type="button"
              className="mt-3 w-full text-center text-[10px] text-zinc-500 transition hover:text-zinc-300"
              onClick={() => dismiss('dismissed')}
            >
              Don&apos;t show again
            </button>
          </div>
        ) : null}
      </NeonCard>
    </div>
  );
}
