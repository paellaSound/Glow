'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { signUpWithPassword } from '@/lib/auth/actions';

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: 'All required fields must be filled in.',
  password_mismatch: 'Passwords do not match.',
  signup_failed: 'Could not create the account. The email may already be registered.',
};

function SignUpForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const error = searchParams.get('error');
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold text-foreground">Create your account</h1>
      <p className="mt-2 text-muted-foreground">
        Temporary email signup for local testing. OAuth will replace this later.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-400">
          {ERROR_MESSAGES[error] ?? 'Sign up failed. Please try again.'}
        </p>
      ) : null}

      {localError ? <p className="mt-4 text-sm text-red-400">{localError}</p> : null}

      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const password = String(formData.get('password') ?? '');
          const confirmPassword = String(formData.get('confirmPassword') ?? '');

          if (password !== confirmPassword) {
            setLocalError('Passwords do not match.');
            return;
          }

          setLocalError(null);
          formData.set('redirect', redirect);
          startTransition(() => signUpWithPassword(formData));
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="Test User" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Repeat password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={`/auth/signin${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
