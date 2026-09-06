import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { ACCESS_REQUEST_TITLE } from '@repo/types';
import { signOut } from '@/app/auth/actions';
import { submitContact } from '@/app/contact/actions';
import { FormAlertMessage } from '@/components/form-alert-message';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { RequestedProjectKeysField } from '@/components/requested-project-keys-field';
import { createClient } from '@/lib/supabase/server';

type AccessDeniedPageProps = {
  readonly searchParams: Promise<{
    reason?: string;
    sent?: string;
    error?: string;
  }>;
};

export default async function AccessDeniedPage({
  searchParams,
}: Readonly<AccessDeniedPageProps>) {
  const resolved = await searchParams;
  const isDeniedOrExpired = resolved.reason === 'denied_or_expired';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let alertMessage: string | null = null;
  let alertIsError = false;
  if (resolved.error) {
    alertMessage = resolved.error;
    alertIsError = true;
  } else if (resolved.sent) {
    alertMessage =
      "Thanks — we've sent your access request to admins. You'll hear back once they review it.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-md space-y-6 rounded-xl border p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          {isDeniedOrExpired ? (
            <p className="text-muted-foreground text-sm">
              Your access is denied or has expired. Ask an admin to review your
              allowlist entry, or send a request below.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Your email isn&apos;t approved for this workspace yet. Tell admins
              which projects you need so they can grant the right access.
            </p>
          )}
        </div>

        <FormAlertMessage message={alertMessage} isError={alertIsError} />

        <form action={submitContact} className="space-y-4">
          <input type="hidden" name="returnTo" value="/access-denied" />
          <input type="hidden" name="title" value={ACCESS_REQUEST_TITLE} />

          <div className="space-y-2">
            <Label htmlFor="access-denied-email">Email</Label>
            <Input
              id="access-denied-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={user?.email ?? ''}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-denied-name">Name (optional)</Label>
            <Input
              id="access-denied-name"
              name="name"
              type="text"
              autoComplete="name"
              className="h-10"
            />
          </div>

          <RequestedProjectKeysField
            id="access-denied-projects"
            helperText="Comma-separated keys for the projects you need. Leave blank if you are unsure — you can still describe them in the message."
          />

          <div className="space-y-2">
            <Label htmlFor="access-denied-message">Message</Label>
            <Textarea
              id="access-denied-message"
              name="message"
              required
              rows={4}
              placeholder="Why you need access, and any project names if you don't know the keys."
              className="min-h-24"
            />
          </div>

          <PendingSubmitButton className="w-full" loadingLabel="Sending...">
            Request access
          </PendingSubmitButton>
        </form>

        <div className="flex flex-col gap-3">
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
