'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import posthog from 'posthog-js';
import { isPostHogEnabled } from '@/lib/posthog-config';

type Props = {
  children: ReactNode;
  surface: 'control' | 'billing' | 'play' | 'visuals';
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class PostHogErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (!isPostHogEnabled()) return;

    posthog.captureException(error, {
      surface: this.props.surface,
      component_stack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">Something went wrong. Try refreshing the page.</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
