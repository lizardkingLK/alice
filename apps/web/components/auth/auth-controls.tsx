'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { signOut } from '@/app/auth/actions';

type AuthControlsProps = {
  email?: string | null;
};

export function AuthControls({ email }: Readonly<AuthControlsProps>) {
  if (email) {
    return (
      <section className="flex items-center gap-4">
        <span className="text-muted-foreground text-sm">{email}</span>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="cursor-pointer">
            Sign Out
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex gap-4">
      <Button variant="outline" asChild className="cursor-pointer">
        <Link href="/login">Sign In</Link>
      </Button>
      <Button asChild className="cursor-pointer">
        <Link href="/signup">Sign Up</Link>
      </Button>
    </section>
  );
}
