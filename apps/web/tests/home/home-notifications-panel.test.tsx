import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeNotificationList } from '@/app/_components/home/home-notifications-panel';
import type { HomeLaunchpadNotification } from '@/app/_components/home/home-launchpad.types';

describe('HomeNotificationList', () => {
  it('does not nest markdown links inside the row stretch link', () => {
    const notifications: HomeLaunchpadNotification[] = [
      {
        id: 'n-1',
        type: 'project_created',
        message: 'Project [**Havit2**](/projects/proj-1) is ready',
        relatedItemId: 'proj-1',
        createdAt: '2026-11-19T06:00:00.000Z',
      },
    ];

    const { container } = render(
      <HomeNotificationList notifications={notifications} />
    );

    const projectLink = screen.getByRole('link', { name: 'Havit2' });
    const rowLink = screen.getByRole('link', {
      name: 'Project Havit2 is ready',
    });

    expect(projectLink).toHaveAttribute('href', '/projects/proj-1');
    expect(rowLink).toHaveAttribute('href', '/projects/proj-1');
    expect(rowLink.contains(projectLink)).toBe(false);
    expect(container.querySelector('a a')).toBeNull();
  });
});
