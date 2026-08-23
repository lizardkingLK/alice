import { HomeCta } from '@/app/_components/home/home-cta';
import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeHowItWorks } from '@/app/_components/home/home-how-it-works';
import { HomeHero } from '@/app/_components/home/home-hero';
import { HomeNavbar } from '@/app/_components/home/home-navbar';
import { HomePricing } from '@/app/_components/home/home-pricing';
import { getMarketingSession } from '@/app/_components/home/get-marketing-session';
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

  return (
    <main className="h-dvh snap-y snap-proximity overflow-x-hidden overflow-y-auto">
      <div className="flex h-dvh shrink-0 snap-start flex-col">
        <HomeNavbar
          email={user?.email}
          profilePicture={dbUser?.profile_picture}
          showDashboardButton
        />
        <HomeHero
          isSignedIn={isSignedIn}
          resetSuccess={resetSuccess}
          accountClosed={accountClosed}
        />
      </div>

      <HomeHowItWorks />
      <HomePricing isSignedIn={isSignedIn} />
      <HomeCta isSignedIn={isSignedIn} />
      <HomeFooter showAppLinks={showAppLinks} />
    </main>
  );
}
