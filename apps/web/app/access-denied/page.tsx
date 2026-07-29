import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { signOut } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { PendingSubmitButton } from '@/components/pending-submit-button';

export default async function AccessDeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-sm space-y-6 rounded-xl border p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Access not available</h1>
          <p className="text-muted-foreground text-sm">
            Your email isn&apos;t approved for this workspace yet. Ask an admin
            to grant access, or send a message via Contact.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full cursor-pointer">
            <Link href="/contact">Contact admin</Link>
          </Button>
          <Button asChild variant="outline" className="w-full cursor-pointer">
            <Link href="/">Back to home</Link>
          </Button>
          {user ? (
            <form action={signOut}>
              <PendingSubmitButton
                variant="ghost"
                className="w-full"
                loadingLabel="Signing out..."
              >
                Sign out
              </PendingSubmitButton>
            </form>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              Already have an approved account?{' '}
              <Link
                href="/login"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
