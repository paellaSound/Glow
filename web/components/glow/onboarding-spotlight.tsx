'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@/lib/onboarding/constants';
import { NeonButton } from '@/components/ui/neon';
import { cn } from '@/lib/utils';

const SPOTLIGHT_PADDING = 10;
const SPOTLIGHT_RADIUS = 14;
const OVERLAY_Z = 45;
const TARGET_Z = 47;
const CALLOUT_Z = 48;

const SPOTLIGHT_TARGET_CLASS = 'onboarding-spotlight-target';

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function selectorForStep(step: OnboardingStepId): string {
  const target = ONBOARDING_STEPS.find((s) => s.id === step)?.target;
  return target ? `[data-onboarding="${target}"]` : '';
}

function measureTarget(selector: string): SpotlightRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    top: Math.max(8, rect.top - SPOTLIGHT_PADDING),
    left: Math.max(8, rect.left - SPOTLIGHT_PADDING),
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

type OverlayPanelsProps = {
  hole: SpotlightRect;
};

function OverlayPanels({ hole }: OverlayPanelsProps) {
  const { top, left, width, height } = hole;
  const bottom = top + height;
  const right = left + width;

  const panelClass =
    'fixed bg-black/45 backdrop-blur-[1px] transition-[top,left,width,height] duration-300 ease-out pointer-events-auto';

  return (
    <>
      <div className={panelClass} style={{ zIndex: OVERLAY_Z, top: 0, left: 0, right: 0, height: top }} />
      <div
        className={panelClass}
        style={{ zIndex: OVERLAY_Z, top: bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div className={panelClass} style={{ zIndex: OVERLAY_Z, top, left: 0, width: left, height }} />
      <div
        className={panelClass}
        style={{ zIndex: OVERLAY_Z, top, left: right, right: 0, height }}
      />
    </>
  );
}

type StepCalloutProps = {
  step: OnboardingStepId;
  hole: SpotlightRect;
  onContinue?: (step: OnboardingStepId) => void;
};

function StepCallout({ step, hole, onContinue }: StepCalloutProps) {
  const meta = ONBOARDING_STEPS.find((s) => s.id === step);
  if (!meta) return null;

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const calloutEstimatedHeight = step === 1 ? 140 : 100;
  const checklistReserve = 280;
  const spaceBelow = viewportHeight - (hole.top + hole.height) - checklistReserve;
  const placeAbove = spaceBelow < calloutEstimatedHeight && hole.top > calloutEstimatedHeight + 16;

  const calloutTop = placeAbove
    ? hole.top - calloutEstimatedHeight - 12
    : hole.top + hole.height + 12;

  const clampedLeft = Math.min(
    Math.max(12, hole.left),
    Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 400) - 280)
  );

  return (
    <div
      className="fixed max-w-[min(20rem,calc(100vw-1.5rem))] animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ zIndex: CALLOUT_Z, top: calloutTop, left: clampedLeft }}
    >
      <div className="rounded-xl border border-neon-cyan/40 bg-zinc-950/95 px-4 py-3 shadow-[0_0_24px_rgba(0,255,255,0.1)]">
        <p className="text-[10px] font-cyber uppercase tracking-widest text-neon-cyan">
          Step {step} of {ONBOARDING_STEPS.length}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{meta.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{meta.description}</p>

        {step === 1 && onContinue ? (
          <NeonButton
            color="cyan"
            variant="solid"
            className="mt-3 h-8 w-full text-[10px] uppercase tracking-widest"
            onClick={() => onContinue(1)}
          >
            I shared the link — continue
          </NeonButton>
        ) : null}

        {step === 2 ? (
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            Opens automatically when a guest joins. Use Share or View QR above, then join from another phone.
          </p>
        ) : null}
      </div>
    </div>
  );
}

type OnboardingSpotlightProps = {
  activeStep: OnboardingStepId | null;
  enabled: boolean;
  onContinueStep?: (step: OnboardingStepId) => void;
};

export function OnboardingSpotlight({
  activeStep,
  enabled,
  onContinueStep,
}: OnboardingSpotlightProps) {
  const [mounted, setMounted] = useState(false);
  const [hole, setHole] = useState<SpotlightRect | null>(null);

  const updateHole = useCallback(() => {
    if (!enabled || activeStep === null) {
      setHole(null);
      return;
    }

    const selector = selectorForStep(activeStep);
    if (!selector) {
      setHole(null);
      return;
    }

    const element = document.querySelector(selector);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    window.requestAnimationFrame(() => {
      setHole(measureTarget(selector));
    });
  }, [activeStep, enabled]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep highlighted target above the dim overlay so Share / QR buttons stay clickable.
  useEffect(() => {
    if (!enabled || activeStep === null) return;

    const selector = selectorForStep(activeStep);
    const element = selector ? document.querySelector(selector) : null;
    if (!element || !(element instanceof HTMLElement)) return;

    element.classList.add(SPOTLIGHT_TARGET_CLASS);
    element.style.setProperty('position', 'relative');
    element.style.setProperty('z-index', String(TARGET_Z));

    return () => {
      element.classList.remove(SPOTLIGHT_TARGET_CLASS);
      element.style.removeProperty('position');
      element.style.removeProperty('z-index');
    };
  }, [activeStep, enabled]);

  // Auto-advance step 1 when user clicks Share or View QR inside the target.
  useEffect(() => {
    if (!enabled || activeStep !== 1 || !onContinueStep) return;

    const element = document.querySelector('[data-onboarding="share"]');
    if (!element) return;

    const onClick = () => {
      window.setTimeout(() => onContinueStep(1), 0);
    };

    element.addEventListener('click', onClick, true);
    return () => element.removeEventListener('click', onClick, true);
  }, [activeStep, enabled, onContinueStep]);

  useEffect(() => {
    updateHole();

    if (!enabled || activeStep === null) return;

    const selector = selectorForStep(activeStep);
    const element = selector ? document.querySelector(selector) : null;

    const onLayout = () => updateHole();

    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);

    const resizeObserver =
      element && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(onLayout)
        : null;
    if (element && resizeObserver) resizeObserver.observe(element);

    const retryId = window.setInterval(updateHole, 400);
    const stopRetry = window.setTimeout(() => window.clearInterval(retryId), 2400);

    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
      resizeObserver?.disconnect();
      window.clearInterval(retryId);
      window.clearTimeout(stopRetry);
    };
  }, [activeStep, enabled, updateHole]);

  if (!mounted || !enabled || activeStep === null) return null;

  const content = hole ? (
    <>
      <OverlayPanels hole={hole} />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed rounded-[14px] border-2 border-neon-cyan',
          'shadow-[0_0_0_1px_rgba(0,255,255,0.2),0_0_20px_rgba(0,255,255,0.25)]',
          'transition-[top,left,width,height] duration-300 ease-out'
        )}
        style={{
          zIndex: TARGET_Z,
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          borderRadius: SPOTLIGHT_RADIUS,
        }}
      />
      <StepCallout step={activeStep} hole={hole} onContinue={onContinueStep} />
    </>
  ) : (
    <div
      className="fixed inset-0 bg-black/45 backdrop-blur-[1px] pointer-events-auto"
      style={{ zIndex: OVERLAY_Z }}
      aria-hidden
    />
  );

  return createPortal(content, document.body);
}
