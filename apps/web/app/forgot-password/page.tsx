import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { requestPasswordReset } from '@/app/auth/actions';

type ForgotPasswordPageProps = {
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: Readonly<ForgotPasswordPageProps>) {
  const { sent, error } = await searchParams;
  const isSent = sent === '1';
  const isExpired = error === 'expired';

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="text-muted-foreground text-sm">
            {isSent
              ? 'Check your inbox for a reset link'
              : 'Enter your email and we will send you a reset link'}
          </p>
        </div>

        {isExpired ? (
          <p className="text-destructive text-sm" role="alert">
            This reset link has expired or is invalid. Request a new one below.
          </p>
        ) : null}

        {error && !isExpired ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {isSent ? (
          <output className="text-muted-foreground text-sm">
            If an account exists for that email, we sent a password reset link.
            Check your spam folder if it does not arrive within a few minutes.
          </output>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
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
            <Button type="submit" className="w-full cursor-pointer">
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-muted-foreground pt-4 text-center text-sm">
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
