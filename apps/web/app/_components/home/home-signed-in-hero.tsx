import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { HomeTimeGreeting } from '@/app/_components/home/home-time-greeting';

type HomeSignedInHeroProps = {
  readonly displayName: string;
  readonly resetSuccess: boolean;
  readonly accountClosed: boolean;
};

export function HomeSignedInHero({
  displayName,
  resetSuccess,
  accountClosed,
}: Readonly<HomeSignedInHeroProps>) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-5 py-6 sm:px-6 sm:py-8 lg:py-14">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          'bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_55%)]'
        )}
      />

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center justify-center text-center">
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

        <HomeTimeGreeting
          displayName={displayName}
          className="text-3xl font-bold tracking-tight text-pretty sm:text-4xl lg:text-5xl"
        />

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
