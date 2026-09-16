'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FAVORITES_CHANGED_EVENT,
  isFavoriteUrl,
  normalizeFavoritePathname,
  readFavorites,
  toggleFavorite,
  type FavoriteRecord,
} from '@/lib/favorites/favorites-storage';

export function useFavorites(userId: string | null | undefined) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }

    setFavorites(readFavorites(userId));

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === `alice:favorites:v1:${userId}`) {
        setFavorites(readFavorites(userId));
      }
    };

    const onFavoritesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId === userId) {
        setFavorites(readFavorites(userId));
      }
    };

    globalThis.window.addEventListener('storage', onStorage);
    globalThis.window.addEventListener(
      FAVORITES_CHANGED_EVENT,
      onFavoritesChanged
    );
    return () => {
      globalThis.window.removeEventListener('storage', onStorage);
      globalThis.window.removeEventListener(
        FAVORITES_CHANGED_EVENT,
        onFavoritesChanged
      );
    };
  }, [userId]);

  const toggle = useCallback(
    (pathname: string, label: string, search = '') => {
      if (!userId) {
        return;
      }
      setFavorites(toggleFavorite(userId, pathname, label, search));
    },
    [userId]
  );

  const isFavorited = useCallback(
    (pathname: string, search = '') =>
      isFavoriteUrl(favorites, pathname, search),
    [favorites]
  );

  return {
    favorites,
    toggle,
    isFavorited,
    normalizePathname: normalizeFavoritePathname,
  };
}
