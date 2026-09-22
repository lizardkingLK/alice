import { HomeFooter } from '@/app/_components/home/home-footer';
import { HomeNavbar } from '@/app/_components/home/home-navbar';
import { getMarketingSession } from '@/app/_components/home/get-marketing-session';
import type { ReactNode } from 'react';

type MarketingShellProps = {
  readonly children: ReactNode;
};

/**
 * Marketing pages aligned with home: first viewport = navbar + content,
 * then a full-viewport snap footer.
 */
export async function MarketingShell({
  children,
}: Readonly<MarketingShellProps>) {
  const { user, dbUser, showAppLinks } = await getMarketingSession();

  return (
    <main className="bg-background h-dvh snap-y snap-proximity overflow-x-hidden overflow-y-auto">
      <div className="flex h-dvh shrink-0 snap-start flex-col">
        <HomeNavbar
          email={user?.email}
          profilePicture={dbUser?.profile_picture}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
      <HomeFooter showAppLinks={showAppLinks} />
    </main>
  );
}
