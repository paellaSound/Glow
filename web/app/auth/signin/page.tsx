'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithGoogle, signInWithPassword } from '@/lib/auth/actions';
import { isEmailAuthEnabled } from '@/lib/auth/email-auth-enabled';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: isEmailAuthEnabled
    ? 'Google sign in failed. Try email and password while OAuth is being configured.'
    : 'Google sign in failed. Please try again.',
  oauth_only: 'Email sign in is not available. Continue with Google instead.',
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
  const redirect = searchParams.get('redirect') ?? '/';
  const error = searchParams.get('error');
  const notice = searchParams.get('notice');
  const [pendingGoogle, startGoogleTransition] = useTransition();
  const [pendingPassword, startPasswordTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold text-foreground">Sign in to Glow</h1>
      <p className="mt-2 text-muted-foreground">
        {isEmailAuthEnabled
          ? 'Email and password for local testing. Google OAuth when configured.'
          : 'Continue with your Google account to access Glow.'}
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

      {isEmailAuthEnabled ? (
        <>
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
                placeholder="Your email"
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
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : (
        <div className="mt-8" />
      )}

      <Button
        size="lg"
        variant={isEmailAuthEnabled ? 'outline' : 'default'}
        className="w-full"
        disabled={pendingGoogle}
        onClick={() => startGoogleTransition(() => signInWithGoogle(redirect))}
      >
        {pendingGoogle ? 'Redirecting...' : 'Continue with Google'}
      </Button>

      {isEmailAuthEnabled ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link
            href={`/auth/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="text-primary hover:underline"
          >
            Create one
          </Link>
        </p>
      ) : null}
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
