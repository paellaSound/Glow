'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ==========================================
// 1. NeonTitle Component
// ==========================================
interface NeonTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  color?: 'cyan' | 'magenta' | 'violet' | 'white';
  flicker?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const NeonTitle = React.forwardRef<HTMLHeadingElement, NeonTitleProps>(
  ({ className, color = 'cyan', flicker = false, as = 'h1', children, ...props }, ref) => {
    const Component = as;
    const colorClasses = {
      cyan: 'text-neon-cyan neon-text-cyan',
      magenta: 'text-neon-magenta neon-text-magenta',
      violet: 'text-neon-violet neon-text-violet',
      white: 'text-white neon-text-white',
    };

    return (
      <Component
        ref={ref}
        className={cn(
          'font-display uppercase tracking-wider',
          colorClasses[color],
          flicker && 'neon-flicker',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
NeonTitle.displayName = 'NeonTitle';

// ==========================================
// 2. NeonButton Component
// ==========================================
interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'cyan' | 'magenta' | 'violet';
  variant?: 'solid' | 'outline' | 'ghost';
  glow?: boolean;
}

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, color = 'cyan', variant = 'outline', glow = true, children, ...props }, ref) => {
    // Buttons are fully rounded as requested: rounded-full
    const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50 h-10 px-6 cursor-pointer font-cyber';

    const colorVariants = {
      cyan: {
        solid: 'bg-neon-cyan text-black hover:bg-white neon-glow-cyan',
        outline: 'border border-neon-cyan/40 bg-transparent text-neon-cyan hover:border-neon-cyan hover:bg-neon-cyan/10 hover:neon-glow-cyan',
        ghost: 'bg-transparent text-neon-cyan hover:bg-neon-cyan/15',
      },
      magenta: {
        solid: 'bg-neon-magenta text-white hover:bg-white hover:text-black neon-glow-magenta',
        outline: 'border border-neon-magenta/40 bg-transparent text-neon-magenta hover:border-neon-magenta hover:bg-neon-magenta/10 hover:neon-glow-magenta',
        ghost: 'bg-transparent text-neon-magenta hover:bg-neon-magenta/15',
      },
      violet: {
        solid: 'bg-neon-violet text-white hover:bg-white hover:text-black neon-glow-violet',
        outline: 'border border-neon-violet/40 bg-transparent text-neon-violet hover:border-neon-violet hover:bg-neon-violet/10 hover:neon-glow-violet',
        ghost: 'bg-transparent text-neon-violet hover:bg-neon-violet/15',
      },
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          colorVariants[color][variant],
          glow && variant === 'solid' && 'shadow-lg hover:scale-[1.02]',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NeonButton.displayName = 'NeonButton';

// ==========================================
// 3. NeonCard Component
// ==========================================
interface NeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: 'cyan' | 'magenta' | 'violet' | 'none';
  borderVariant?: 'cyan' | 'magenta' | 'violet' | 'default';
  hoverEffect?: boolean;
}

export const NeonCard = React.forwardRef<HTMLDivElement, NeonCardProps>(
  ({ className, glowColor = 'none', borderVariant = 'default', hoverEffect = true, children, ...props }, ref) => {
    const borderClasses = {
      default: 'border-border/60 dark:border-white/10',
      cyan: 'border-neon-cyan/25 dark:border-neon-cyan/20',
      magenta: 'border-neon-magenta/25 dark:border-neon-magenta/20',
      violet: 'border-neon-violet/25 dark:border-neon-violet/20',
    };

    const shadowClasses = {
      none: '',
      cyan: 'shadow-[0_0_15px_-3px_rgba(0,229,255,0.07)] dark:shadow-[0_0_20px_-5px_rgba(0,229,255,0.1)]',
      magenta: 'shadow-[0_0_15px_-3px_rgba(255,0,200,0.07)] dark:shadow-[0_0_20px_-5px_rgba(255,0,200,0.1)]',
      violet: 'shadow-[0_0_15px_-3px_rgba(122,0,255,0.07)] dark:shadow-[0_0_20px_-5px_rgba(122,0,255,0.1)]',
    };

    const hoverShadowClasses: Record<string, string> = {
      none: 'hover:border-border/80 dark:hover:border-white/20',
      default: 'hover:border-border/80 dark:hover:border-white/20',
      cyan: 'hover:border-neon-cyan/50 dark:hover:border-neon-cyan/40 hover:shadow-[0_0_25px_-2px_rgba(0,229,255,0.15)]',
      magenta: 'hover:border-neon-magenta/50 dark:hover:border-neon-magenta/40 hover:shadow-[0_0_25px_-2px_rgba(255,0,200,0.15)]',
      violet: 'hover:border-neon-violet/50 dark:hover:border-neon-violet/40 hover:shadow-[0_0_25px_-2px_rgba(122,0,255,0.15)]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-2xl border bg-card/80 dark:bg-card/45 backdrop-blur-md transition-all duration-300 p-6',
          borderClasses[borderVariant],
          shadowClasses[glowColor],
          hoverEffect && 'hover:scale-[1.01] hover:bg-card/90 dark:hover:bg-card/55',
          hoverEffect && hoverShadowClasses[glowColor === 'none' ? borderVariant : glowColor],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
NeonCard.displayName = 'NeonCard';

// ==========================================
// 4. SectionGlow Component
// ==========================================
interface SectionGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: 'cyan' | 'magenta' | 'violet' | 'mixed';
  position?: 'top' | 'bottom' | 'center' | 'full';
}

export function SectionGlow({
  glowColor = 'mixed',
  position = 'top',
  className,
  ...props
}: SectionGlowProps) {
  const gradientStyles = {
    cyan: 'from-neon-cyan/8 via-transparent to-transparent',
    magenta: 'from-neon-magenta/8 via-transparent to-transparent',
    violet: 'from-neon-violet/8 via-transparent to-transparent',
    mixed: 'from-neon-violet/6 via-neon-magenta/4 to-transparent',
  };

  const positionStyles = {
    top: 'top-0 left-1/2 -translate-x-1/2 w-[90%] md:w-[70%] h-[35vh] rounded-b-full blur-[100px]',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 w-[90%] md:w-[70%] h-[35vh] rounded-t-full blur-[100px]',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[40vh] rounded-full blur-[120px]',
    full: 'inset-0 w-full h-full blur-[140px]',
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute -z-10 bg-gradient-to-b opacity-70 dark:opacity-100',
        gradientStyles[glowColor],
        positionStyles[position],
        className
      )}
      {...props}
    />
  );
}

// ==========================================
// 5. PageTransitionWrapper Component
// ==========================================
export function PageTransitionWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      className={cn(
        'transition-all duration-700 ease-out transform',
        isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className
      )}
    >
      {children}
    </div>
  );
}
