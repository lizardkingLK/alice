import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { buildLoginPath, resolveSafeRedirectPath } from '@/lib/auth-redirect';

type CheckEmailPageProps = {
  readonly searchParams: Promise<{ email?: string; next?: string }>;
};

export default async function CheckEmailPage({
  searchParams,
}: Readonly<CheckEmailPageProps>) {
  const { email, next: nextParam } = await searchParams;
  const next = resolveSafeRedirectPath(nextParam, '');
  const loginHref = buildLoginPath(next || undefined);
  const forgotHref = email?.trim()
    ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
    : '/forgot-password';

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            Sign-in didn&apos;t work for this address. If an admin invited or
            allowlisted you, open that email or set a password, then try again.
            If you already have a password, you may have mistyped it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full cursor-pointer">
            <Link href={forgotHref}>Set or reset password</Link>
          </Button>
          <Button asChild variant="outline" className="w-full cursor-pointer">
            <Link href={loginHref}>Back to sign in</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full cursor-pointer">
            <Link href="/contact">Contact admin</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
