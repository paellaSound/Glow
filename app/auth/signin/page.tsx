'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithGoogle, signInWithPassword } from '@/lib/auth/actions';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Google sign in failed. Try email and password while OAuth is being configured.',
  invalid_credentials: 'Invalid email or password.',
  email_not_confirmed:
    'Confirm your email before signing in. Check your inbox for the Supabase confirmation link.',
  missing_fields: 'Email and password are required.',
  auth_callback_failed: 'Sign in failed. Please try again.',
};

const NOTICE_MESSAGES: Record<string, string> = {
  confirm_email:
    'Account created. Confirm your email, then sign in here. For local dev, disable email confirmation in Supabase Auth settings.',
};

function SignInForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/room/new';
  const error = searchParams.get('error');
  const notice = searchParams.get('notice');
  const [pendingGoogle, startGoogleTransition] = useTransition();
  const [pendingPassword, startPasswordTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold text-white">Sign in to Glow</h1>
      <p className="mt-2 text-zinc-400">
        Email and password for local testing. Google OAuth when configured.
      </p>

      {notice ? (
        <p className="mt-4 text-sm text-emerald-400">
          {NOTICE_MESSAGES[notice] ?? notice}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-400">
          {ERROR_MESSAGES[error] ?? 'Sign in failed. Please try again.'}
        </p>
      ) : null}

      <form
        className="mt-8 space-y-4"
        action={(formData) => {
          formData.set('redirect', redirect);
          startPasswordTransition(() => signInWithPassword(formData));
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="test@test.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pendingPassword}>
          {pendingPassword ? 'Signing in...' : 'Sign in with email'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <Button
        size="lg"
        variant="outline"
        className="w-full border-white/20 bg-transparent text-white hover:bg-white/5"
        disabled={pendingGoogle}
        onClick={() => startGoogleTransition(() => signInWithGoogle(redirect))}
      >
        {pendingGoogle ? 'Redirecting...' : 'Continue with Google'}
      </Button>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No account yet?{' '}
        <Link
          href={`/auth/signup${redirect !== '/room/new' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
          className="text-orange-400 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
