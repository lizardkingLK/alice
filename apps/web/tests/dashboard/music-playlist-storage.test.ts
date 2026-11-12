import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
}));

import {
  DEFAULT_MUSIC_PLAYLIST_PREFERENCES,
  isPlaylistUrl,
  musicPlaylistEmbedUrl,
  normalizeMusicPlaylistPreferences,
  readMusicPlaylistPreferences,
  setMusicPlaylistUrl,
  setSelectedMusicProvider,
  shiftMusicProvider,
  writeMusicPlaylistPreferences,
} from '@/app/dashboard/_helpers/music-playlist-storage';

describe('music-playlist-storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to Spotify with empty URLs', () => {
    expect(readMusicPlaylistPreferences('user-1')).toEqual(
      DEFAULT_MUSIC_PLAYLIST_PREFERENCES
    );
  });

  it('round-trips selected provider and playlist URLs', () => {
    const prefs = setMusicPlaylistUrl(
      setSelectedMusicProvider(DEFAULT_MUSIC_PLAYLIST_PREFERENCES, 'youtube'),
      'youtube',
      'https://music.youtube.com/playlist?list=PLdemo'
    );
    writeMusicPlaylistPreferences('user-1', prefs);
    expect(readMusicPlaylistPreferences('user-1')).toEqual(prefs);
  });

  it('normalizes unknown blobs and trims URLs', () => {
    expect(
      normalizeMusicPlaylistPreferences({
        selectedProvider: 'nope',
        urls: { spotify: '  https://open.spotify.com/playlist/abc  ' },
      })
    ).toEqual({
      selectedProvider: 'spotify',
      urls: { spotify: 'https://open.spotify.com/playlist/abc' },
    });
  });

  it('validates http(s) playlist URLs', () => {
    expect(isPlaylistUrl('https://open.spotify.com/playlist/x')).toBe(true);
    expect(isPlaylistUrl('ftp://example.com')).toBe(false);
    expect(isPlaylistUrl('not-a-url')).toBe(false);
  });

  it('builds embed URLs for known providers', () => {
    expect(
      musicPlaylistEmbedUrl(
        'spotify',
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
      )
    ).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
    expect(
      musicPlaylistEmbedUrl(
        'youtube',
        'https://music.youtube.com/playlist?list=PLdemo'
      )
    ).toBe('https://www.youtube.com/embed/videoseries?list=PLdemo');
    expect(
      musicPlaylistEmbedUrl('soundcloud', 'https://soundcloud.com/user/sets/x')
    ).toContain('w.soundcloud.com/player');
    expect(
      musicPlaylistEmbedUrl(
        'apple',
        'https://music.apple.com/us/playlist/pl.u-demo'
      )
    ).toContain('embed.music.apple.com');
  });

  it('cycles providers with shiftMusicProvider', () => {
    expect(shiftMusicProvider('spotify', 1)).toBe('youtube');
    expect(shiftMusicProvider('spotify', -1)).toBe('soundcloud');
  });
});
