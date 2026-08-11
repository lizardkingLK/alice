import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  favoritesStorageKey,
  isPathnameFavorited,
  normalizeFavoritePathname,
  normalizeFavoritesList,
  readFavorites,
  toggleFavorite,
} from '@/lib/favorites/favorites-storage';

describe('favorites-storage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it('strips query and hash from pathnames', () => {
    expect(normalizeFavoritePathname('/projects?x=1#top')).toBe('/projects');
    expect(normalizeFavoritePathname('/work-items/')).toBe('/work-items');
  });

  it('dedupes by pathname and keeps newest-first order on toggle add', () => {
    const userId = 'user-1';
    toggleFavorite(userId, '/projects?tab=1', 'Projects');
    toggleFavorite(userId, '/work-items', 'Work Items');

    const favorites = readFavorites(userId);
    expect(favorites).toHaveLength(2);
    expect(favorites[0]?.pathname).toBe('/work-items');
    expect(favorites[1]?.pathname).toBe('/projects');
    expect(favoritesStorageKey(userId)).toContain(userId);
  });

  it('toggles off an existing favorite', () => {
    const userId = 'user-1';
    toggleFavorite(userId, '/projects', 'Projects');
    expect(isPathnameFavorited(readFavorites(userId), '/projects')).toBe(true);

    toggleFavorite(userId, '/projects?ignored=1', 'Projects');
    expect(readFavorites(userId)).toHaveLength(0);
  });

  it('normalizes corrupt storage to an empty list', () => {
    expect(normalizeFavoritesList(null)).toEqual([]);
    expect(normalizeFavoritesList([{ pathname: '/x' }])).toEqual([]);
  });
});
