import { Check } from '@repo/ui/lib/icons';
import { HomeAuthButtons } from '@/app/_components/home/home-auth-buttons';
import { HomeSectionHeading } from '@/app/_components/home/home-section-heading';
import { cn } from '@repo/ui/lib/utils';

/** Full Free-plan surface list — mirrors what the app ships today. */
export const FREE_PLAN_FEATURES = [
  'Project workspaces',
  'Kanban boards',
  'Backlog planning',
  'Sprint planning & tracking',
  'Sprint reports',
  'Work items & task tracking',
  'Personal My Work queue',
  'Customizable dashboards',
  'Team calendar',
  'Saved & shareable views',
  'AI assistant chat',
  'Comments & mentions',
  'File attachments',
  'In-app notifications',
  'Project teams',
  'Role-based access',
  'User management',
  'Profile & account settings',
  'Favorites & pinned navigation',
  'Built-in product docs',
] as const;

type HomePricingProps = {
  readonly isSignedIn: boolean;
};

export function HomePricing({ isSignedIn }: Readonly<HomePricingProps>) {
  return (
    <section
      id="pricing"
      aria-labelledby="home-pricing-heading"
      className="border-border/60 relative flex min-h-dvh shrink-0 snap-start flex-col justify-center overflow-y-auto border-t px-6 py-14 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <HomeSectionHeading
          eyebrow="Pricing"
          headingId="home-pricing-heading"
          title="Free while we grow with you"
          description="Everything in Alice is included on the Free plan right now — no tiers, no feature gates, no credit card."
        />

        <div
          className={cn(
            'border-border/70 bg-card/80 mx-auto mt-12 max-w-3xl rounded-2xl border p-6 shadow-sm sm:p-8',
            'backdrop-blur-sm'
          )}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium tracking-wide uppercase">
                Free
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                  $0
                </span>
                <span className="text-muted-foreground text-sm">forever</span>
              </div>
              <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-relaxed">
                Full access to planning, delivery, collaboration, and reporting
                for your team.
              </p>
            </div>

            <HomeAuthButtons
              isSignedIn={isSignedIn}
              showSignedOutSecondary={false}
              className="w-full shrink-0 sm:w-auto"
            />
          </div>

          <div className="border-border/60 mt-8 border-t pt-8">
            <p className="text-sm font-medium tracking-tight">
              Everything included
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {FREE_PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <span className="bg-primary/10 text-primary mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3" aria-hidden strokeWidth={3} />
                  </span>
                  <span className="leading-snug">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
