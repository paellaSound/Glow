'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function authRedirect(path: string, redirectTo?: string) {
  const target = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/room/new';
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}redirect=${encodeURIComponent(target)}`);
}

async function bootstrapFromSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { bootstrapUserProfile } = await import('@/lib/db/queries');
  return bootstrapUserProfile(
    user.id,
    user.email ?? '',
    user.user_metadata?.full_name ?? user.user_metadata?.name,
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture
  );
}

export async function signInWithGoogle(redirectTo?: string) {
  const supabase = await createClient();
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`,
    },
  });

  if (error) {
    authRedirect('/auth/signin?error=oauth_failed', redirectTo);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirect') ?? '/room/new');

  if (!email || !password) {
    authRedirect('/auth/signin?error=missing_fields', redirectTo);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const errorCode = error.message.toLowerCase().includes('email not confirmed')
      ? 'email_not_confirmed'
      : 'invalid_credentials';
    authRedirect(`/auth/signin?error=${errorCode}`, redirectTo);
  }

  await bootstrapFromSession();
  redirect(redirectTo.startsWith('/') ? redirectTo : '/room/new');
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const redirectTo = String(formData.get('redirect') ?? '/room/new');

  if (!email || !password || !confirmPassword) {
    authRedirect('/auth/signup?error=missing_fields', redirectTo);
  }

  if (password !== confirmPassword) {
    authRedirect('/auth/signup?error=password_mismatch', redirectTo);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error) {
    authRedirect('/auth/signup?error=signup_failed', redirectTo);
  }

  if (data.session) {
    await bootstrapFromSession();
    redirect(redirectTo.startsWith('/') ? redirectTo : '/room/new');
  }

  authRedirect('/auth/signin?notice=confirm_email', redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function ensureUserBootstrap() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { bootstrapUserProfile } = await import('@/lib/db/queries');
  return bootstrapUserProfile(
    user.id,
    user.email ?? '',
    user.user_metadata?.full_name ?? user.user_metadata?.name,
    user.user_metadata?.avatar_url ?? user.user_metadata?.picture
  );
}

