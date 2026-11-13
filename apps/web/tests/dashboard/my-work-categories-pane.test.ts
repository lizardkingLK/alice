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
  DEFAULT_MY_WORK_CATEGORIES_PANE,
  readMyWorkCategoriesPane,
  shiftMyWorkCategoriesPane,
  writeMyWorkCategoriesPane,
} from '@/app/dashboard/_helpers/my-work-categories-pane';

describe('my work categories pane', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to assigned and round-trips', () => {
    expect(readMyWorkCategoriesPane('user-1')).toBe(
      DEFAULT_MY_WORK_CATEGORIES_PANE
    );
    writeMyWorkCategoriesPane('user-1', 'pending-stories');
    expect(readMyWorkCategoriesPane('user-1')).toBe('pending-stories');
  });

  it('cycles assigned → in progress → pending', () => {
    expect(shiftMyWorkCategoriesPane('assigned', 1)).toBe('in-progress');
    expect(shiftMyWorkCategoriesPane('in-progress', 1)).toBe('pending-stories');
    expect(shiftMyWorkCategoriesPane('pending-stories', 1)).toBe('assigned');
    expect(shiftMyWorkCategoriesPane('assigned', -1)).toBe('pending-stories');
  });
});
