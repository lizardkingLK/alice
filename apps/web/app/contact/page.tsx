import Link from 'next/link';
import { submitContact } from './actions';
import { FormAlertMessage } from '@/components/form-alert-message';
import { getDbUser, getUser } from '@/lib/auth';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';

type ContactPageProps = {
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function ContactPage({
  searchParams,
}: Readonly<ContactPageProps>) {
  const { sent, error } = await searchParams;
  const [authUser, dbUser] = await Promise.all([getUser(), getDbUser()]);

  const defaultEmail = authUser?.email ?? dbUser?.email ?? '';
  const defaultName = dbUser?.name ?? '';

  let alertMessage: string | null = null;
  let alertIsError = false;
  if (error) {
    alertMessage = error;
    alertIsError = true;
  } else if (sent) {
    alertMessage = "Thanks — we've sent your message to the admins.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="border-border w-full max-w-xl space-y-6 rounded-xl border p-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Contact admin</h1>
          <p className="text-muted-foreground text-sm">
            Send an access request or message. We&apos;ll notify admins in-app.
          </p>
        </div>

        <form action={submitContact} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={defaultEmail}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                defaultValue={defaultName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Subject (optional)</Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Access request"
              defaultValue=""
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              required
              placeholder="Tell us who you are and what access you need."
              rows={6}
            />
          </div>

          <FormAlertMessage message={alertMessage} isError={alertIsError} />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="submit" className="w-full cursor-pointer sm:w-auto">
              Send message
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full cursor-pointer sm:w-auto"
            >
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
