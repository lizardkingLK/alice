import type { Metadata } from 'next';
import { appDescription, appSubtitle, appTitle } from '@/app/_shared/values';
import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeNavbar } from '@/app/_components/home/home-navbar';
import { getMarketingSession } from '@/app/_components/home/get-marketing-session';
import { AboutFlowStory } from '@/app/about/_components/about-flow-story';
import { AboutIntegrationsPanel } from '@/app/about/_components/about-integrations-panel';

export const metadata: Metadata = {
  title: 'About',
  description: `Learn what ${appTitle} is and how it helps teams ${appSubtitle.toLowerCase()}.`,
};

export default async function AboutPage() {
  const { user, dbUser, showAppLinks } = await getMarketingSession();

  return (
    <main className="bg-background h-dvh snap-y snap-proximity overflow-x-hidden overflow-y-auto">
      <div className="flex h-dvh shrink-0 snap-start flex-col">
        <HomeNavbar
          email={user?.email}
          profilePicture={dbUser?.profile_picture}
        />
        <section className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-6 py-8 sm:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_55%)]"
          />
          <div className="relative mx-auto w-full max-w-3xl">
            <p className="text-primary text-sm font-medium tracking-wide">
              About {appTitle}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-pretty sm:text-4xl lg:text-5xl">
              A focused workspace for planning and delivery
            </h1>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-pretty sm:text-base lg:text-lg">
              {appDescription}
            </p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty sm:text-base lg:text-lg">
              {appSubtitle}. Scroll through the Alice flow — project to
              dashboard — and the integrations that keep context in one place.
            </p>
          </div>
        </section>
      </div>

      <AboutFlowStory />
      <AboutIntegrationsPanel />
      <HomeFooter showAppLinks={showAppLinks} />
    </main>
  );
}
