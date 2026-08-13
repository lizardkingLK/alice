import Link from 'next/link';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { login } from '@/app/auth/actions';
import GoogleLogin from '@/app/login/_components/google-login';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { resolveSafeRedirectPath } from '@/lib/auth-redirect';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; reset?: string; next?: string }>;
};

export default async function LoginPage({
  searchParams,
}: Readonly<LoginPageProps>) {
  const { error, reset, next: nextParam } = await searchParams;
  const resetSuccess = reset === 'success';
  const next = resolveSafeRedirectPath(nextParam, '');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Access your Alice workspace
          </p>
        </div>

        {resetSuccess ? (
          <output className="text-sm text-emerald-600">
            Your password has been reset. Sign in with your new password.
          </output>
        ) : null}

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <form action={login} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-muted-foreground text-xs underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <PendingSubmitButton className="w-full" loadingLabel="Signing in...">
            Sign In
          </PendingSubmitButton>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          No account?{' '}
          <Link
            href="/signup"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>

        <p className="text-muted-foreground text-center">or</p>

        <GoogleLogin next={next || undefined} />
      </div>
    </main>
  );
}
