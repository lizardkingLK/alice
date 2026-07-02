import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { signUp } from '@/app/auth/actions';

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
            Get started with Jira Teams
          </p>
        </div>

        {showCheckEmail ? (
          <output className="text-sm text-emerald-600">
            Check your email for a confirmation link. After confirming, sign in
            to continue.
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
            <Button type="submit" className="w-full cursor-pointer">
              Sign Up
            </Button>
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
