import { describe, expect, it } from 'vitest';
import { listParamsForUsersPageTab } from '@/lib/search-params';

describe('listParamsForUsersPageTab', () => {
  const parsed = { page: 2, limit: 10, search: 'alice' };

  it('keeps page and search for the active tab', () => {
    expect(listParamsForUsersPageTab(parsed, 'users', 'users')).toEqual(parsed);
  });

  it('resets page and search for the inactive tab', () => {
    expect(listParamsForUsersPageTab(parsed, 'users', 'allowlist')).toEqual({
      page: 1,
      limit: 10,
      search: '',
    });
  });
});
