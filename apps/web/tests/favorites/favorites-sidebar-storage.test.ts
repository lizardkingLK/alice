import { beforeEach, describe, expect, it } from 'vitest';
import {
  favoritesSidebarOpenStorageKey,
  readFavoritesSidebarOpen,
  writeFavoritesSidebarOpen,
} from '@/lib/favorites/favorites-sidebar-storage';

const USER_ID = 'user-favorites-sidebar-1';
const STORAGE_KEY = favoritesSidebarOpenStorageKey(USER_ID);

describe('favorites-sidebar-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to expanded when nothing is stored or user is missing', () => {
    expect(readFavoritesSidebarOpen(USER_ID)).toBe(true);
    expect(readFavoritesSidebarOpen(undefined)).toBe(true);
  });

  it('persists collapsed and expanded preference', () => {
    writeFavoritesSidebarOpen(USER_ID, false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe(false);
    expect(readFavoritesSidebarOpen(USER_ID)).toBe(false);

    writeFavoritesSidebarOpen(USER_ID, true);
    expect(readFavoritesSidebarOpen(USER_ID)).toBe(true);
  });

  it('skips writes without a user id', () => {
    writeFavoritesSidebarOpen(null, false);
    expect(localStorage).toHaveLength(0);
  });
});
