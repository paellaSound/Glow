import { PostHogErrorBoundary } from '@/components/analytics/error-boundary';

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <PostHogErrorBoundary surface="control">
      <div className="min-h-screen bg-background text-foreground">
        {children}
      </div>
    </PostHogErrorBoundary>
  );
}
