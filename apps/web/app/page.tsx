import { HomeCta } from '@/app/_components/home/home-cta';
import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeHowItWorks } from '@/app/_components/home/home-how-it-works';
import { HomeHero } from '@/app/_components/home/home-hero';
import { HomeNavbar } from '@/app/_components/home/home-navbar';
import { HomePricing } from '@/app/_components/home/home-pricing';
import { HomeSignedInLaunchpad } from '@/app/_components/home/home-signed-in-launchpad';
import { getHomeLaunchpadBootstrap } from '@/app/_components/home/home-launchpad.reads.server';
import { getMarketingSession } from '@/app/_components/home/get-marketing-session';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import './globals.css';

type HomeProps = {
  searchParams: Promise<{ reset?: string; account?: string }>;
};

export default async function Home({ searchParams }: Readonly<HomeProps>) {
  const { user, dbUser, showAppLinks, isSignedIn } =
    await getMarketingSession();

  const { reset, account } = await searchParams;
  const resetSuccess = reset === 'success';
  const accountClosed = account === 'closed';

  if (isSignedIn && user?.email) {
    const emptyBootstrap = {
      name: dbUser?.name?.trim() || user.email.split('@')[0] || 'there',
      handle: `@${user.email.split('@')[0] || 'user'}`,
      email: user.email,
      role: dbUser?.role ?? 'member',
      avatarUrl: dbUser?.profile_picture ?? null,
      coverUrl: dbUser?.cover_picture ?? null,
      projects: [] as const,
      wipItems: [] as const,
      unreadNotifications: [] as const,
      completion: { doneCount: 0, totalCount: 0, percent: 0 },
    };

    const bootstrap = dbUser
      ? await safeServerFetch(
          getHomeLaunchpadBootstrap({
            userId: dbUser.id,
            email: user.email,
            name: dbUser.name,
            role: dbUser.role,
            avatarUrl: dbUser.profile_picture,
            coverUrl: dbUser.cover_picture,
          }),
          emptyBootstrap,
          'fetch home launchpad bootstrap'
        )
      : emptyBootstrap;

    return (
      <main className="h-dvh snap-y snap-proximity overflow-x-hidden overflow-y-auto">
        <div className="bg-background flex h-dvh shrink-0 snap-start flex-col overflow-hidden">
          <HomeNavbar
            email={user.email}
            profilePicture={dbUser?.profile_picture}
          />
          <HomeSignedInLaunchpad
            bootstrap={bootstrap}
            resetSuccess={resetSuccess}
            accountClosed={accountClosed}
          />
        </div>
        <HomeFooter
          showAppLinks={showAppLinks}
          hideMarketingAnchors
          variant="snap"
        />
      </main>
    );
  }

  return (
    <main className="h-dvh snap-y snap-proximity overflow-x-hidden overflow-y-auto">
      <div className="flex h-dvh shrink-0 snap-start flex-col">
        <HomeNavbar
          email={user?.email}
          profilePicture={dbUser?.profile_picture}
        />
        <HomeHero resetSuccess={resetSuccess} accountClosed={accountClosed} />
      </div>

      <HomeHowItWorks />
      <HomePricing isSignedIn={false} />
      <HomeCta isSignedIn={false} />
      <HomeFooter showAppLinks={showAppLinks} />
    </main>
  );
}
