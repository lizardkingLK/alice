'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FAVORITES_CHANGED_EVENT,
  isPathnameFavorited,
  normalizeFavoritePathname,
  readFavorites,
  toggleFavorite,
  type FavoriteRecord,
} from '@/lib/favorites/favorites-storage';

export function useFavorites(userId: string | null | undefined) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);

  const refresh = useCallback(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    setFavorites(readFavorites(userId));
  }, [userId]);

  useEffect(() => {
    refresh();

    if (!userId || globalThis.window === undefined) {
      return;
    }

    const onFavoritesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) {
        return;
      }
      refresh();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith('alice:favorites:v1:')) {
        return;
      }
      refresh();
    };

    globalThis.window.addEventListener(
      FAVORITES_CHANGED_EVENT,
      onFavoritesChanged
    );
    globalThis.window.addEventListener('storage', onStorage);
    return () => {
      globalThis.window.removeEventListener(
        FAVORITES_CHANGED_EVENT,
        onFavoritesChanged
      );
      globalThis.window.removeEventListener('storage', onStorage);
    };
  }, [refresh, userId]);

  const toggle = useCallback(
    (pathname: string, label: string) => {
      if (!userId) {
        return;
      }
      setFavorites(toggleFavorite(userId, pathname, label));
    },
    [userId]
  );

  const isFavorited = useCallback(
    (pathname: string) => isPathnameFavorited(favorites, pathname),
    [favorites]
  );

  return {
    favorites,
    toggle,
    isFavorited,
    normalizePathname: normalizeFavoritePathname,
  };
}
