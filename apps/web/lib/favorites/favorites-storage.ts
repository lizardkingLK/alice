import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export type FavoriteRecord = {
  readonly id: string;
  readonly pathname: string;
  /** Query string without a leading `?` (same convention as saved views). */
  readonly search: string;
  readonly label: string;
  readonly createdAt: string;
};

const STORAGE_PREFIX = 'alice:favorites:v1:';

/** Same-tab signal so sidebar / star stay in sync. */
export const FAVORITES_CHANGED_EVENT = 'alice:favorites-changed';

export function favoritesStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** Strip query/hash; normalize trailing slash (except root). */
export function normalizeFavoritePathname(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || '/';
}

/** Normalize search to no leading `?` (empty string when none). */
export function normalizeFavoriteSearch(search: string): string {
  const trimmed = search.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
}

export function favoriteKey(pathname: string, search = ''): string {
  const normalizedPath = normalizeFavoritePathname(pathname);
  const normalizedSearch = normalizeFavoriteSearch(search);
  return normalizedSearch
    ? `${normalizedPath}?${normalizedSearch}`
    : normalizedPath;
}

export function favoriteHref(
  record: Pick<FavoriteRecord, 'pathname' | 'search'>
): string {
  const pathname = normalizeFavoritePathname(record.pathname);
  const search = normalizeFavoriteSearch(record.search);
  return search ? `${pathname}?${search}` : pathname;
}

function isFavoriteRecordShape(value: unknown): value is {
  id: string;
  pathname: string;
  label: string;
  createdAt: string;
  search?: unknown;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.pathname === 'string' &&
    typeof record.label === 'string' &&
    typeof record.createdAt === 'string' &&
    (record.search === undefined || typeof record.search === 'string')
  );
}

export function normalizeFavoritesList(value: unknown): FavoriteRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byKey = new Map<string, FavoriteRecord>();
  for (const item of value) {
    if (!isFavoriteRecordShape(item)) {
      continue;
    }
    const pathname = normalizeFavoritePathname(item.pathname);
    if (!pathname) {
      continue;
    }
    // Legacy rows (no search) and pathname that accidentally included ?query
    // both migrate: prefer explicit search, else parse from pathname input.
    const rawPathSearch = item.pathname.includes('?')
      ? (item.pathname.split('?')[1]?.split('#')[0] ?? '')
      : '';
    const search = normalizeFavoriteSearch(
      typeof item.search === 'string' ? item.search : rawPathSearch
    );
    const key = favoriteKey(pathname, search);
    if (byKey.has(key)) {
      continue;
    }
    byKey.set(key, {
      id: item.id,
      pathname,
      search,
      label: item.label.trim() || pathname,
      createdAt: item.createdAt,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.createdAt < b.createdAt) {
      return 1;
    }
    if (a.createdAt > b.createdAt) {
      return -1;
    }
    return 0;
  });
}

export function readFavorites(userId: string): FavoriteRecord[] {
  if (!userId) {
    return [];
  }
  return normalizeFavoritesList(
    getLocalStorageJson<unknown>(favoritesStorageKey(userId))
  );
}

function writeFavorites(userId: string, favorites: FavoriteRecord[]): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(favoritesStorageKey(userId), favorites);
  emitFavoritesChanged(userId);
}

function emitFavoritesChanged(userId: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  globalThis.window.dispatchEvent(
    new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: { userId } })
  );
}

let favoriteIdCounter = 0;

function createFavoriteId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  favoriteIdCounter += 1;
  return `fav-${Date.now()}-${favoriteIdCounter}`;
}

export function isFavoriteUrl(
  favorites: readonly FavoriteRecord[],
  pathname: string,
  search = ''
): boolean {
  const key = favoriteKey(pathname, search);
  return favorites.some(
    (item) => favoriteKey(item.pathname, item.search) === key
  );
}

/** @deprecated Prefer {@link isFavoriteUrl}. */
export function isPathnameFavorited(
  favorites: readonly FavoriteRecord[],
  pathname: string,
  search = ''
): boolean {
  return isFavoriteUrl(favorites, pathname, search);
}

export function toggleFavorite(
  userId: string,
  pathname: string,
  label: string,
  search = ''
): FavoriteRecord[] {
  const normalizedPath = normalizeFavoritePathname(pathname);
  const normalizedSearch = normalizeFavoriteSearch(search);
  const key = favoriteKey(normalizedPath, normalizedSearch);
  const current = readFavorites(userId);
  const exists = current.some(
    (item) => favoriteKey(item.pathname, item.search) === key
  );

  const next = exists
    ? current.filter((item) => favoriteKey(item.pathname, item.search) !== key)
    : [
        {
          id: createFavoriteId(),
          pathname: normalizedPath,
          search: normalizedSearch,
          label: label.trim() || normalizedPath,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];

  writeFavorites(userId, next);
  return next;
}

export function isFavoriteActive(
  currentPathname: string,
  currentSearch: string,
  favorite: Pick<FavoriteRecord, 'pathname' | 'search'>
): boolean {
  return (
    favoriteKey(currentPathname, currentSearch) ===
    favoriteKey(favorite.pathname, favorite.search)
  );
}
