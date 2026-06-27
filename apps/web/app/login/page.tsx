import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { login } from '@/app/auth/actions';

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({
  searchParams,
}: Readonly<LoginPageProps>) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Access your Jira Teams workspace
          </p>
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <form action={login} className="space-y-4">
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
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full cursor-pointer">
            Sign In
          </Button>
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
      </div>
    </main>
  );
}
