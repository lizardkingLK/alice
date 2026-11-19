import { describe, expect, it } from 'vitest';
import { getHomeQuickLinks } from '@/app/_components/home/home-quick-links';

describe('getHomeQuickLinks', () => {
  it('gives admins project and user actions first', () => {
    const ids = getHomeQuickLinks('admin').map((link) => link.id);
    expect(ids).toEqual(['projects', 'users', 'overview', 'alice']);
  });

  it('gives managers team and sprint actions', () => {
    const ids = getHomeQuickLinks('manager').map((link) => link.id);
    expect(ids).toEqual(['overview', 'manager', 'sprints', 'board']);
  });

  it('gives members personal workspace actions', () => {
    const ids = getHomeQuickLinks('member').map((link) => link.id);
    expect(ids).toEqual(['overview', 'my-work', 'board', 'alice']);
  });
});
