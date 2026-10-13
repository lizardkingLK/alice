import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateDropdownCacheMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/cache/dropdown-cache', () => ({
  DROPDOWN_CACHE_TAGS: {
    projects: 'dropdown-projects',
    users: 'dropdown-users',
  },
  invalidateDropdownCache: invalidateDropdownCacheMock,
}));

import { invalidateProjectDropdownCache } from '@/app/projects/_services/projects.cache.actions.server';

describe('invalidateProjectDropdownCache', () => {
  beforeEach(() => {
    invalidateDropdownCacheMock.mockReset();
  });

  it('expires the shared project dropdown cache', async () => {
    await invalidateProjectDropdownCache();

    expect(invalidateDropdownCacheMock).toHaveBeenCalledOnce();
    expect(invalidateDropdownCacheMock).toHaveBeenCalledWith(
      'dropdown-projects'
    );
  });
});
