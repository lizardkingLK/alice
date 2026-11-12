/**
 * Overview Music widget: selected provider + playlist URLs per provider.
 * Browser localStorage only (UI-first; no OAuth yet).
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-music-playlists:v1:';

export const MUSIC_PROVIDERS = [
  'spotify',
  'youtube',
  'apple',
  'soundcloud',
] as const;

export type MusicProviderId = (typeof MUSIC_PROVIDERS)[number];

export type MusicProviderMeta = {
  readonly id: MusicProviderId;
  readonly label: string;
  readonly placeholder: string;
};

export const MUSIC_PROVIDER_CATALOG: readonly MusicProviderMeta[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    placeholder: 'https://open.spotify.com/playlist/…',
  },
  {
    id: 'youtube',
    label: 'YouTube Music',
    placeholder: 'https://music.youtube.com/playlist?list=…',
  },
  {
    id: 'apple',
    label: 'Apple Music',
    placeholder: 'https://music.apple.com/…/playlist/…',
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    placeholder: 'https://soundcloud.com/…/sets/…',
  },
];

export const DEFAULT_MUSIC_PROVIDER: MusicProviderId = 'spotify';
export const MUSIC_PLAYLIST_URL_MAX = 2048;

export type MusicPlaylistPreferences = {
  readonly selectedProvider: MusicProviderId;
  readonly urls: Readonly<Partial<Record<MusicProviderId, string>>>;
};

export const DEFAULT_MUSIC_PLAYLIST_PREFERENCES: MusicPlaylistPreferences = {
  selectedProvider: DEFAULT_MUSIC_PROVIDER,
  urls: {},
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isMusicProviderId(value: unknown): value is MusicProviderId {
  return (
    typeof value === 'string' &&
    (MUSIC_PROVIDERS as readonly string[]).includes(value)
  );
}

export function musicProviderMeta(
  provider: MusicProviderId
): MusicProviderMeta {
  return (
    MUSIC_PROVIDER_CATALOG.find((entry) => entry.id === provider) ??
    MUSIC_PROVIDER_CATALOG[0]!
  );
}

export function normalizePlaylistUrl(value: string): string {
  return value.trim().slice(0, MUSIC_PLAYLIST_URL_MAX);
}

/** Soft http(s) check for the Music widget input (UI-first). */
export function isPlaylistUrl(value: string): boolean {
  const trimmed = normalizePlaylistUrl(value);
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeMusicPlaylistPreferences(
  value: unknown
): MusicPlaylistPreferences {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const selectedProvider = isMusicProviderId(source.selectedProvider)
    ? source.selectedProvider
    : DEFAULT_MUSIC_PROVIDER;

  const urls: Partial<Record<MusicProviderId, string>> = {};
  const rawUrls =
    source.urls &&
    typeof source.urls === 'object' &&
    !Array.isArray(source.urls)
      ? (source.urls as Record<string, unknown>)
      : {};
  for (const provider of MUSIC_PROVIDERS) {
    const entry = rawUrls[provider];
    if (typeof entry !== 'string') {
      continue;
    }
    const normalized = normalizePlaylistUrl(entry);
    if (normalized) {
      urls[provider] = normalized;
    }
  }

  return { selectedProvider, urls };
}

export function readMusicPlaylistPreferences(
  userId: string | null | undefined
): MusicPlaylistPreferences {
  if (!userId) {
    return DEFAULT_MUSIC_PLAYLIST_PREFERENCES;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (raw == null) {
    return DEFAULT_MUSIC_PLAYLIST_PREFERENCES;
  }
  return normalizeMusicPlaylistPreferences(raw);
}

export function writeMusicPlaylistPreferences(
  userId: string | null | undefined,
  prefs: MusicPlaylistPreferences
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(
    storageKey(userId),
    normalizeMusicPlaylistPreferences(prefs)
  );
}

export function setSelectedMusicProvider(
  prefs: MusicPlaylistPreferences,
  provider: MusicProviderId
): MusicPlaylistPreferences {
  if (!isMusicProviderId(provider)) {
    return prefs;
  }
  return { ...prefs, selectedProvider: provider };
}

export function setMusicPlaylistUrl(
  prefs: MusicPlaylistPreferences,
  provider: MusicProviderId,
  url: string
): MusicPlaylistPreferences {
  if (!isMusicProviderId(provider)) {
    return prefs;
  }
  const normalized = normalizePlaylistUrl(url);
  const urls = { ...prefs.urls };
  if (!normalized) {
    delete urls[provider];
  } else {
    urls[provider] = normalized;
  }
  return { ...prefs, urls };
}

export function shiftMusicProvider(
  current: MusicProviderId,
  direction: -1 | 1
): MusicProviderId {
  const index = MUSIC_PROVIDERS.indexOf(current);
  const safeIndex = Math.max(index, 0);
  const next =
    (safeIndex + direction + MUSIC_PROVIDERS.length) % MUSIC_PROVIDERS.length;
  return MUSIC_PROVIDERS[next]!;
}

/**
 * Best-effort embed URL for iframe preview. Returns null when the link is not
 * a known playlist shape (caller can still offer “Open playlist”).
 */
export function musicPlaylistEmbedUrl(
  provider: MusicProviderId,
  url: string
): string | null {
  if (!isPlaylistUrl(url)) {
    return null;
  }
  try {
    const parsed = new URL(normalizePlaylistUrl(url));
    if (provider === 'spotify') {
      const match = parsed.pathname.match(
        /\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/
      );
      if (!match) {
        return null;
      }
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
    if (provider === 'youtube') {
      const list = parsed.searchParams.get('list');
      if (!list) {
        return null;
      }
      return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`;
    }
    if (provider === 'soundcloud') {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.toString())}&auto_play=false`;
    }
    if (provider === 'apple') {
      // music.apple.com → embed.music.apple.com keeps path/query.
      if (!parsed.hostname.includes('music.apple.com')) {
        return null;
      }
      parsed.hostname = 'embed.music.apple.com';
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}
