import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeNavbar } from '@/app/_components/home/home-navbar';
import { getMarketingSession } from '@/app/_components/home/get-marketing-session';
import type { ReactNode } from 'react';

type MarketingShellProps = {
  readonly children: ReactNode;
  readonly mainClassName?: string;
};

export async function MarketingShell({
  children,
  mainClassName,
}: Readonly<MarketingShellProps>) {
  const { user, dbUser, showAppLinks } = await getMarketingSession();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <HomeNavbar
        email={user?.email}
        profilePicture={dbUser?.profile_picture}
      />
      <main className={mainClassName ?? 'flex-1'}>{children}</main>
      <HomeFooter showAppLinks={showAppLinks} variant="inline" />
    </div>
  );
}
