import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bootstrapUserProfile, getTeamForUser, profileExists } from '@/lib/db/queries';
import { getPostHogClient } from '@/lib/posthog-server';
import {
  captureServerEvent,
  identifyOrchestrator,
} from '@/lib/posthog-analytics';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const isNewUser = !(await profileExists(user.id));

        await bootstrapUserProfile(
          user.id,
          user.email ?? '',
          user.user_metadata?.full_name ?? user.user_metadata?.name,
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture
        );

        const posthog = getPostHogClient();
        const team = await getTeamForUser();

        if (team) {
          identifyOrchestrator(posthog, user.id, {
            team_id: team.id,
            plan_code: team.plan.code,
            subscription_status: team.subscriptionStatus,
          });
        }

        if (isNewUser) {
          captureServerEvent(posthog, user.id, 'signup_completed', {
            method: 'google',
          }, team ? { team: team.id } : undefined);
        }

        captureServerEvent(
          posthog,
          user.id,
          'signin_completed',
          { method: 'google', is_new_user: isNewUser },
          team ? { team: team.id } : undefined
        );

        await posthog.shutdown();
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/signin?error=auth_callback_failed`);
}
