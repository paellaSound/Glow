'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { createClient } from '@/lib/supabase/client';

export function PostHogIdentify() {
  useEffect(() => {
    const supabase = createClient();

    async function identify() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.full_name ?? user.user_metadata?.name,
        });
      }
    }

    void identify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name,
        });
      } else if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
