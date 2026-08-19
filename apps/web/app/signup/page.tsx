import Link from 'next/link';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { SIGNUP_CHECK_EMAIL_MESSAGE } from '@/lib/auth-existing-account';
import { signUp } from '@/app/auth/actions';
import { PendingSubmitButton } from '@/components/pending-submit-button';

type SignUpPageProps = {
  searchParams: Promise<{ error?: string; checkEmail?: string }>;
};

export default async function SignUpPage({
  searchParams,
}: Readonly<SignUpPageProps>) {
  const { error, checkEmail } = await searchParams;
  const showCheckEmail = checkEmail === '1';

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="text-muted-foreground text-sm">
            {showCheckEmail
              ? 'Check your inbox for the next steps'
              : 'Get started with Alice'}
          </p>
        </div>

        {showCheckEmail ? (
          <output className="text-muted-foreground text-sm">
            {SIGNUP_CHECK_EMAIL_MESSAGE} Check your spam folder if it does not
            arrive within a few minutes.
          </output>
        ) : (
          <form action={signUp} className="space-y-4">
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <PendingSubmitButton
              className="w-full"
              loadingLabel="Signing up..."
            >
              Sign Up
            </PendingSubmitButton>
          </form>
        )}

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <p className="text-muted-foreground pt-4 text-center text-sm">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
