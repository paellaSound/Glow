'use client';

import { useEffect, useRef } from 'react';
import { trackBillingPageViewed } from '@/lib/billing/analytics';

type BillingPageTrackerProps = {
  currentPlanCode: string;
};

export function BillingPageTracker({ currentPlanCode }: BillingPageTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackBillingPageViewed(currentPlanCode);
  }, [currentPlanCode]);

  return null;
}
