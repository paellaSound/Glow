'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ONBOARDING_STEPS, type OnboardingStepId } from '@/lib/onboarding/constants';
import { cn } from '@/lib/utils';

const SPOTLIGHT_PADDING = 10;
const SPOTLIGHT_RADIUS = 14;
const OVERLAY_Z = 45;
const CALLOUT_Z = 46;

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
    'fixed bg-black/72 backdrop-blur-[3px] transition-[top,left,width,height] duration-300 ease-out';

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
};

function StepCallout({ step, hole }: StepCalloutProps) {
  const meta = ONBOARDING_STEPS.find((s) => s.id === step);
  if (!meta) return null;

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const calloutEstimatedHeight = 88;
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
      className="pointer-events-none fixed max-w-[min(20rem,calc(100vw-1.5rem))] animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ zIndex: CALLOUT_Z, top: calloutTop, left: clampedLeft }}
    >
      <div className="rounded-xl border border-neon-cyan/40 bg-zinc-950/95 px-4 py-3 shadow-[0_0_32px_rgba(0,255,255,0.12)]">
        <p className="text-[10px] font-cyber uppercase tracking-widest text-neon-cyan">
          Step {step} of {ONBOARDING_STEPS.length}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{meta.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{meta.description}</p>
      </div>
    </div>
  );
}

type OnboardingSpotlightProps = {
  activeStep: OnboardingStepId | null;
  enabled: boolean;
};

export function OnboardingSpotlight({ activeStep, enabled }: OnboardingSpotlightProps) {
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
          'shadow-[0_0_0_1px_rgba(0,255,255,0.25),0_0_28px_rgba(0,255,255,0.35)]',
          'transition-[top,left,width,height] duration-300 ease-out'
        )}
        style={{
          zIndex: CALLOUT_Z,
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          borderRadius: SPOTLIGHT_RADIUS,
        }}
      />
      <StepCallout step={activeStep} hole={hole} />
    </>
  ) : (
    <div
      className="fixed inset-0 bg-black/72 backdrop-blur-[3px]"
      style={{ zIndex: OVERLAY_Z }}
      aria-hidden
    />
  );

  return createPortal(content, document.body);
}
