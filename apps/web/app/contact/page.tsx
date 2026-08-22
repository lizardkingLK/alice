import type { Metadata } from 'next';
import Link from 'next/link';
import { submitContact } from './actions';
import { ContactSubjectField } from './_components/contact-subject-field';
import { FormAlertMessage } from '@/components/form-alert-message';
import { getDbUser, getUser } from '@/lib/auth';
import { MarketingShell } from '@/app/_components/home/marketing-shell';
import { appTitle } from '@/app/_shared/values';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Reach the ${appTitle} team for access requests, questions, or feedback.`,
};

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
    alertMessage = "Thanks — we've sent your message to the team.";
  }

  return (
    <MarketingShell>
      <div className="px-6 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-primary text-sm font-medium tracking-wide">
            Contact
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Talk to the team
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty sm:text-base">
            Ask about access, share feedback, or get help getting started.
            Messages are delivered to admins in-app.
          </p>

          <form
            action={submitContact}
            className="border-border/70 bg-card/50 mt-6 space-y-5 rounded-2xl border p-5 sm:p-6"
          >
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={defaultEmail}
                  className="h-10"
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
                  className="h-10"
                />
              </div>
            </div>

            <ContactSubjectField />

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                required
                placeholder="Tell us how we can help."
                rows={5}
                className="min-h-28"
              />
            </div>

            <FormAlertMessage message={alertMessage} isError={alertIsError} />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                size="lg"
                className="w-full cursor-pointer sm:w-auto"
              >
                Send message
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full cursor-pointer sm:w-auto"
              >
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </MarketingShell>
  );
}
