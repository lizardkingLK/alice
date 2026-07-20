import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';

type HomeCtaProps = {
  isSignedIn: boolean;
};

export function HomeCta({ isSignedIn }: Readonly<HomeCtaProps>) {
  return (
    <section
      aria-labelledby="home-cta-heading"
      className="border-border/60 relative flex min-h-dvh snap-start snap-always flex-col items-center justify-center overflow-hidden border-t px-6 py-12"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_60%)]"
      />
      <div className="motion-safe:animate-in motion-safe:fade-in relative mx-auto flex max-w-3xl flex-col items-center text-center motion-safe:duration-700">
        <h2
          id="home-cta-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {isSignedIn
            ? 'Jump back into your workspace'
            : 'Start planning with your team'}
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl text-base text-pretty sm:text-lg">
          {isSignedIn
            ? 'Open the dashboard to review widgets, boards, and the work already in flight.'
            : 'Create an account to manage projects, backlogs, and boards in one workspace.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isSignedIn ? (
            <Button asChild size="lg">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/signup">Create account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
