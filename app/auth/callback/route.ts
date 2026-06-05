import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bootstrapUserProfile } from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/room/new';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await bootstrapUserProfile(
          user.id,
          user.email ?? '',
          user.user_metadata?.full_name ?? user.user_metadata?.name,
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
