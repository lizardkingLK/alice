import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BOARD_SYNC_PREFS,
  readBoardSyncPrefs,
  resolveSubscribeStatusEvents,
  shouldSubscribeBoardWorkItems,
  writeBoardSyncPrefs,
} from '@/app/board/_helpers/board-sync-storage';

describe('board-sync-storage', () => {
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

  it('defaults to realtime with subscribe on', () => {
    expect(readBoardSyncPrefs('user-1')).toEqual(DEFAULT_BOARD_SYNC_PREFS);
    expect(shouldSubscribeBoardWorkItems(DEFAULT_BOARD_SYNC_PREFS)).toBe(true);
  });

  it('persists static mode and disables subscribe', () => {
    writeBoardSyncPrefs('user-1', {
      syncMode: 'static',
      subscribeStatusEvents: false,
    });
    expect(readBoardSyncPrefs('user-1')).toEqual({
      syncMode: 'static',
      subscribeStatusEvents: false,
    });
    expect(
      shouldSubscribeBoardWorkItems({
        syncMode: 'static',
        subscribeStatusEvents: false,
      })
    ).toBe(false);
  });

  it('ignores corrupt values', () => {
    localStorage.setItem(
      'alice:board-sync:v1:user-1',
      JSON.stringify({ syncMode: 'nope' })
    );
    expect(readBoardSyncPrefs('user-1')).toEqual(DEFAULT_BOARD_SYNC_PREFS);
  });

  it('resolves subscribe flag when switching sync modes', () => {
    expect(
      resolveSubscribeStatusEvents('static', DEFAULT_BOARD_SYNC_PREFS)
    ).toBe(false);
    expect(
      resolveSubscribeStatusEvents('realtime', {
        syncMode: 'static',
        subscribeStatusEvents: false,
      })
    ).toBe(true);
    expect(
      resolveSubscribeStatusEvents('realtime', {
        syncMode: 'realtime',
        subscribeStatusEvents: false,
      })
    ).toBe(false);
  });
});
