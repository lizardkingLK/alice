import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeSignedInLaunchpad } from '@/app/_components/home/home-signed-in-launchpad';
import type { HomeLaunchpadBootstrap } from '@/app/_components/home/home-launchpad.types';

vi.mock('@/app/_components/home/home-time-greeting', () => ({
  HomeTimeGreeting: ({ className }: { className?: string }) => (
    <h2 className={className}>Good Afternoon</h2>
  ),
}));

vi.mock('@/app/_components/home/home-cover-banner', () => ({
  HomeCoverBanner: () => <div data-testid="cover" />,
}));

vi.mock('@/app/_components/home/home-quick-links-panel', () => ({
  HomeQuickLinksPanel: () => <div>Quick links</div>,
}));

const emptyBootstrap: HomeLaunchpadBootstrap = {
  name: 'Alice Admin',
  handle: '@admin',
  email: 'admin@alice.dev',
  role: 'admin',
  avatarUrl: null,
  coverUrl: null,
  projects: [],
  wipItems: [],
  unreadNotifications: [],
  completion: { percent: 0, doneCount: 0, totalCount: 0 },
};

describe('HomeSignedInLaunchpad empty feed', () => {
  it('collapses the center column when there is no WIP or notifications', () => {
    const { container } = render(
      <HomeSignedInLaunchpad
        bootstrap={emptyBootstrap}
        resetSuccess={false}
        accountClosed={false}
      />
    );

    expect(screen.getByText('Good Afternoon')).toBeInTheDocument();
    expect(screen.queryByText('Work in progress')).toBeNull();
    expect(screen.queryByText('Unread notifications')).toBeNull();
    const grid = container.querySelector('.grid');
    expect(grid?.className).toContain('lg:grid-cols-[17.5rem_minmax(0,1fr)]');
    expect(grid?.className).not.toContain(
      'lg:grid-cols-[17.5rem_minmax(0,1fr)_15.5rem]'
    );
  });

  it('keeps a center column when WIP items exist', () => {
    const { container } = render(
      <HomeSignedInLaunchpad
        bootstrap={{
          ...emptyBootstrap,
          wipItems: [
            {
              id: 'wi-1',
              title: 'Ship chips',
              status: 'InProgress',
              projectKey: 'ALICE',
              slug: 'ship-chips',
              updatedAt: '2026-11-11T00:00:00.000Z',
            },
          ],
          completion: { percent: 0, doneCount: 0, totalCount: 1 },
        }}
        resetSuccess={false}
        accountClosed={false}
      />
    );

    expect(screen.getByText('Work in progress')).toBeInTheDocument();
    expect(screen.getByText('Ship chips')).toBeInTheDocument();
    expect(container.querySelector('.grid')?.className).toContain(
      'lg:grid-cols-[17.5rem_minmax(0,1fr)_15.5rem]'
    );
  });
});
