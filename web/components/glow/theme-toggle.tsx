'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const themes = [
  { value: 'light', label: 'Light theme', icon: Sun },
  { value: 'dark', label: 'Dark theme', icon: Moon },
  { value: 'system', label: 'System theme', icon: Monitor },
] as const;

function themeIndex(value: string | undefined) {
  const index = themes.findIndex((theme) => theme.value === value);
  return index >= 0 ? index : 0;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !theme || isAnimatingRef.current) return;
    setActiveIndex(themeIndex(theme));
  }, [mounted, theme]);

  const handleClick = () => {
    if (isAnimatingRef.current) return;

    const nextIndex = (activeIndex + 1) % themes.length;
    isAnimatingRef.current = true;
    setOutgoingIndex(activeIndex);
    setActiveIndex(nextIndex);
    setTheme(themes[nextIndex].value);
  };

  const handleAnimationEnd = () => {
    setOutgoingIndex(null);
    isAnimatingRef.current = false;
  };

  if (!mounted) {
    return <div className={cn('size-8 shrink-0', className)} aria-hidden />;
  }

  const ActiveIcon = themes[activeIndex].icon;
  const OutgoingIcon = outgoingIndex !== null ? themes[outgoingIndex].icon : null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${themes[activeIndex].label}. Click to switch theme.`}
      className={cn(
        'size-8 shrink-0 text-muted-foreground hover:text-neon-cyan hover:neon-text-cyan',
        className,
      )}
      onClick={handleClick}
    >
      <span className="relative block size-4 overflow-hidden">
        {OutgoingIcon ? (
          <span
            className="absolute inset-0 flex items-center justify-center theme-toggle-slide-out"
            onAnimationEnd={handleAnimationEnd}
          >
            <OutgoingIcon className="size-4" />
          </span>
        ) : null}
        <span
          className={cn(
            'flex size-4 items-center justify-center',
            outgoingIndex !== null && 'theme-toggle-slide-in',
          )}
        >
          <ActiveIcon className="size-4" />
        </span>
      </span>
    </Button>
  );
}
