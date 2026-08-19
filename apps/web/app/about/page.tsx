import type { Metadata } from 'next';
import Link from 'next/link';
import { appDescription, appSubtitle, appTitle } from '@/app/_shared/values';
import { HomeAuthButtons } from '@/app/_components/home/home-auth-buttons';
import { MarketingShell } from '@/app/_components/home/marketing-shell';
import { Button } from '@repo/ui/components/ui/button';

export const metadata: Metadata = {
  title: 'About',
  description: `Learn what ${appTitle} is and how it helps teams ${appSubtitle.toLowerCase()}.`,
};

const pillars = [
  {
    title: 'One workspace',
    description:
      'Projects, backlogs, sprints, boards, and dashboards live together so context never gets lost between tools.',
  },
  {
    title: 'Built for delivery',
    description:
      'Plan the work, move it across the board, and review progress without rebuilding your process every quarter.',
  },
  {
    title: 'Free while we grow',
    description:
      'Alice is free today with the full feature set. We are focused on making the product useful before we invent tiers.',
  },
] as const;

export default function AboutPage() {
  return (
    <MarketingShell>
      <div className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-primary text-sm font-medium tracking-wide">
            About {appTitle}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-pretty sm:text-5xl">
            A focused workspace for planning and delivery
          </h1>
          <p className="text-muted-foreground mt-5 text-base leading-relaxed text-pretty sm:text-lg">
            {appDescription}
          </p>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {appSubtitle}. That is the job: help teams see the work, commit to
            what matters, and ship without the noise of a bloated suite.
          </p>
        </div>

        <ul className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-3 sm:gap-6">
          {pillars.map((pillar) => (
            <li
              key={pillar.title}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
            >
              <h2 className="text-base font-semibold tracking-tight">
                {pillar.title}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {pillar.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center gap-3">
          <HomeAuthButtons isSignedIn={false} showSignedOutSecondary={false} />
          <Button
            asChild
            size="lg"
            variant="outline"
            className="cursor-pointer"
          >
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </MarketingShell>
  );
}
