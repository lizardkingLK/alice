import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { formatHomeRoleLabel } from '@/app/_components/home/format-home-role-label';
import { HomeTimeGreeting } from '@/app/_components/home/home-time-greeting';
import '@/app/_components/home/home-signed-in-hero.css';

type HomeSignedInHeroProps = {
  readonly displayName: string;
  readonly role?: string | null;
  readonly profilePicture?: string | null;
  readonly resetSuccess: boolean;
  readonly accountClosed: boolean;
};

function initialsFromDisplayName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'A';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function HomeSignedInHero({
  displayName,
  role,
  profilePicture,
  resetSuccess,
  accountClosed,
}: Readonly<HomeSignedInHeroProps>) {
  const roleLabel = formatHomeRoleLabel(role);
  const initials = initialsFromDisplayName(displayName);

  return (
    <section
      className={cn(
        'home-signed-in-surface relative flex min-h-0 flex-1 flex-col items-center justify-center',
        'overflow-hidden px-5 py-6 sm:px-6 sm:py-8 lg:py-14'
      )}
    >
      <div
        className={cn(
          'home-signed-in-glass relative mx-auto flex w-full max-w-lg flex-col items-center',
          'rounded-3xl border px-6 py-10 text-center sm:px-10 sm:py-12'
        )}
      >
        {resetSuccess ? (
          <output className="mb-4 block text-sm text-emerald-600 sm:mb-6">
            Password updated. Sign in with your new password.
          </output>
        ) : null}
        {accountClosed ? (
          <output className="text-muted-foreground mb-4 block max-w-md text-sm sm:mb-6">
            Your account has been deactivated. Contact an administrator if you
            need access restored.
          </output>
        ) : null}

        <Avatar className="border-border/60 mb-5 size-20 border shadow-sm sm:mb-6 sm:size-24">
          {profilePicture ? <AvatarImage src={profilePicture} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold sm:text-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        <HomeTimeGreeting
          displayName={displayName}
          className="text-3xl font-bold tracking-tight text-pretty sm:text-4xl"
        />

        {roleLabel ? (
          <p className="text-muted-foreground mt-2 text-sm font-medium tracking-wide sm:text-base">
            {roleLabel}
          </p>
        ) : null}

        <div className="mt-8 sm:mt-10">
          <Button
            asChild
            className="h-12 cursor-pointer px-8 text-base sm:h-14 sm:px-10 sm:text-lg"
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
