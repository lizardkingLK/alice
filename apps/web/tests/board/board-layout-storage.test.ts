import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_LAYOUT_OPTIONS,
  readBoardLayout,
  writeBoardLayout,
} from '@/app/board/_helpers/board-layout-storage';

describe('board-layout-storage', () => {
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

  it('defaults to board and persists grouped', () => {
    expect(readBoardLayout('user-1')).toBe('board');
    writeBoardLayout('user-1', 'grouped');
    expect(readBoardLayout('user-1')).toBe('grouped');
    expect(BOARD_LAYOUT_OPTIONS.map((option) => option.id)).toEqual([
      'board',
      'grouped',
    ]);
  });

  it('ignores corrupt values', () => {
    localStorage.setItem('alice:board-layout:v1:user-1', '"nope"');
    expect(readBoardLayout('user-1')).toBe('board');
  });
});
