import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readMoreFieldsOpen,
  writeMoreFieldsOpen,
} from '@/app/work-items/_helpers/work-item-sidebar-storage';

const USER_ID = 'user-test-1';
const STORAGE_KEY = `alice:work-item-more-fields:${USER_ID}`;

describe('work-item-sidebar-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults More fields to closed when nothing is stored', () => {
    expect(readMoreFieldsOpen(USER_ID)).toBe(false);
    expect(readMoreFieldsOpen(undefined)).toBe(false);
  });

  it('persists open and closed More fields preference', () => {
    writeMoreFieldsOpen(USER_ID, true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe(true);
    expect(readMoreFieldsOpen(USER_ID)).toBe(true);

    writeMoreFieldsOpen(USER_ID, false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe(false);
    expect(readMoreFieldsOpen(USER_ID)).toBe(false);
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(STORAGE_KEY, '"yes"');
    expect(readMoreFieldsOpen(USER_ID)).toBe(false);
  });

  it('no-ops writes without a user id', () => {
    writeMoreFieldsOpen(null, true);
    expect(localStorage).toHaveLength(0);
  });
});
