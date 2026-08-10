import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

/** Expanded by default when no preference is stored. */
const favoritesSidebarPreference = createBooleanLocalPreference({
  storagePrefix: 'alice:favorites-sidebar-open:v1:',
  defaultValue: true,
});

export const favoritesSidebarOpenStorageKey =
  favoritesSidebarPreference.storageKey;
export const readFavoritesSidebarOpen = favoritesSidebarPreference.read;
export const writeFavoritesSidebarOpen = favoritesSidebarPreference.write;
