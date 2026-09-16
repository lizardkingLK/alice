import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  favoriteHref,
  favoriteKey,
  favoritesStorageKey,
  isFavoriteActive,
  isFavoriteUrl,
  normalizeFavoritePathname,
  normalizeFavoriteSearch,
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

  it('normalizes search without a leading ?', () => {
    expect(normalizeFavoriteSearch('?project=1&tab=mine')).toBe(
      'project=1&tab=mine'
    );
    expect(normalizeFavoriteSearch('')).toBe('');
    expect(normalizeFavoriteSearch('  ')).toBe('');
  });

  it('builds favorite key and href from pathname + search', () => {
    expect(favoriteKey('/board/', 'project=1')).toBe('/board?project=1');
    expect(favoriteHref({ pathname: '/board', search: 'project=1' })).toBe(
      '/board?project=1'
    );
    expect(favoriteHref({ pathname: '/projects', search: '' })).toBe(
      '/projects'
    );
  });

  it('dedupes by pathname+search and keeps newest-first order on toggle add', () => {
    const userId = 'user-1';
    toggleFavorite(userId, '/board', 'Board', 'project=1');
    toggleFavorite(userId, '/work-items', 'Work Items');

    const favorites = readFavorites(userId);
    expect(favorites).toHaveLength(2);
    expect(favorites[0]?.pathname).toBe('/work-items');
    expect(favorites[0]?.search).toBe('');
    expect(favorites[1]?.pathname).toBe('/board');
    expect(favorites[1]?.search).toBe('project=1');
    expect(favoritesStorageKey(userId)).toContain(userId);
  });

  it('treats pathname-only and pathname+search as distinct favorites', () => {
    const userId = 'user-1';
    toggleFavorite(userId, '/board', 'Board');
    toggleFavorite(userId, '/board', 'Board filtered', 'project=1');

    const favorites = readFavorites(userId);
    expect(favorites).toHaveLength(2);
    expect(isFavoriteUrl(favorites, '/board')).toBe(true);
    expect(isFavoriteUrl(favorites, '/board', 'project=1')).toBe(true);
    expect(isFavoriteUrl(favorites, '/board', 'project=2')).toBe(false);
  });

  it('toggles off an existing favorite matching pathname+search', () => {
    const userId = 'user-1';
    toggleFavorite(userId, '/board', 'Board', 'project=1');
    expect(isFavoriteUrl(readFavorites(userId), '/board', 'project=1')).toBe(
      true
    );

    toggleFavorite(userId, '/board', 'Board', '?project=1');
    expect(readFavorites(userId)).toHaveLength(0);
  });

  it('migrates legacy records missing search to empty search', () => {
    const migrated = normalizeFavoritesList([
      {
        id: 'legacy-1',
        pathname: '/projects',
        label: 'Projects',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(migrated).toEqual([
      {
        id: 'legacy-1',
        pathname: '/projects',
        search: '',
        label: 'Projects',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('extracts search from legacy pathname that included a query', () => {
    const migrated = normalizeFavoritesList([
      {
        id: 'legacy-2',
        pathname: '/board?project=abc',
        label: 'Board',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    expect(migrated[0]).toMatchObject({
      pathname: '/board',
      search: 'project=abc',
      label: 'Board',
    });
    expect(favoriteHref(migrated[0]!)).toBe('/board?project=abc');
  });

  it('matches active favorite on exact pathname+search', () => {
    expect(
      isFavoriteActive('/board', 'project=1', {
        pathname: '/board',
        search: 'project=1',
      })
    ).toBe(true);
    expect(
      isFavoriteActive('/board', '', {
        pathname: '/board',
        search: 'project=1',
      })
    ).toBe(false);
  });

  it('normalizes corrupt storage to an empty list', () => {
    expect(normalizeFavoritesList(null)).toEqual([]);
    expect(normalizeFavoritesList([{ pathname: '/x' }])).toEqual([]);
  });
});
