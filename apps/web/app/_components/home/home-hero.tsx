import { cn } from '@repo/ui/lib/utils';
import { appDescription, appSubtitle } from '@/app/_shared/values';
import { HomeAuthButtons } from '@/app/_components/home/home-auth-buttons';
import { HomeFeaturesCarousel } from '@/app/_components/home/home-features-carousel';

type HomeHeroProps = {
  readonly isSignedIn: boolean;
  readonly resetSuccess: boolean;
  readonly accountClosed: boolean;
};

export function HomeHero({
  isSignedIn,
  resetSuccess,
  accountClosed,
}: Readonly<HomeHeroProps>) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-5 py-6 sm:px-6 sm:py-8 lg:py-14">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0',
          'bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_55%)]'
        )}
      />

      <div
        className={cn(
          'relative mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-8',
          'lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16'
        )}
      >
        <div className="block w-full max-w-xl shrink-0">
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

          <p className="text-primary text-sm font-medium tracking-wide">
            Project management, composed
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-pretty sm:text-4xl lg:text-5xl">
            {appSubtitle}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed text-pretty sm:mt-4 sm:text-base lg:text-lg">
            {appDescription}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            <HomeAuthButtons
              isSignedIn={isSignedIn}
              showSignedOutSecondary={false}
            />
          </div>
        </div>

        <div className="block min-h-0 w-full max-w-md shrink lg:mx-0 lg:max-w-none">
          <HomeFeaturesCarousel />
        </div>
      </div>
    </section>
  );
}
