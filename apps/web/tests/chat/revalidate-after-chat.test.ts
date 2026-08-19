import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateDropdownCacheMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/cache/dropdown-cache', () => ({
  DROPDOWN_CACHE_TAGS: {
    projects: 'dropdown-projects',
    users: 'dropdown-users',
  },
  invalidateDropdownCache: invalidateDropdownCacheMock,
}));

import { revalidateAfterChatActions } from '@/lib/cache/revalidate-after-chat';

describe('revalidateAfterChatActions', () => {
  beforeEach(() => {
    invalidateDropdownCacheMock.mockReset();
  });

  it('does nothing when chat performed no mutations', async () => {
    await revalidateAfterChatActions([]);

    expect(invalidateDropdownCacheMock).not.toHaveBeenCalled();
  });

  it('expires the project dropdown cache after create_project', async () => {
    await revalidateAfterChatActions(['create_project']);

    expect(invalidateDropdownCacheMock).toHaveBeenCalledWith(
      'dropdown-projects'
    );
  });

  it('does not touch the project dropdown for sprint-only actions', async () => {
    await revalidateAfterChatActions(['create_sprint']);

    expect(invalidateDropdownCacheMock).not.toHaveBeenCalled();
  });
});
