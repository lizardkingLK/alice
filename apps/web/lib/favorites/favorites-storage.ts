import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export type FavoriteRecord = {
  readonly id: string;
  readonly pathname: string;
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

function isFavoriteRecord(value: unknown): value is FavoriteRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.pathname === 'string' &&
    typeof record.label === 'string' &&
    typeof record.createdAt === 'string'
  );
}

export function normalizeFavoritesList(value: unknown): FavoriteRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byPath = new Map<string, FavoriteRecord>();
  for (const item of value) {
    if (!isFavoriteRecord(item)) {
      continue;
    }
    const pathname = normalizeFavoritePathname(item.pathname);
    if (!pathname || byPath.has(pathname)) {
      continue;
    }
    byPath.set(pathname, {
      id: item.id,
      pathname,
      label: item.label.trim() || pathname,
      createdAt: item.createdAt,
    });
  }

  return [...byPath.values()].sort((a, b) => {
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

export function isPathnameFavorited(
  favorites: readonly FavoriteRecord[],
  pathname: string
): boolean {
  const normalized = normalizeFavoritePathname(pathname);
  return favorites.some((item) => item.pathname === normalized);
}

export function toggleFavorite(
  userId: string,
  pathname: string,
  label: string
): FavoriteRecord[] {
  const normalized = normalizeFavoritePathname(pathname);
  const current = readFavorites(userId);
  const exists = current.some((item) => item.pathname === normalized);

  const next = exists
    ? current.filter((item) => item.pathname !== normalized)
    : [
        {
          id: createFavoriteId(),
          pathname: normalized,
          label: label.trim() || normalized,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];

  writeFavorites(userId, next);
  return next;
}
