import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
  hasCustomViewsTableColumnVisibility,
  normalizeViewsTableColumnVisibility,
  readViewsTableColumnVisibility,
  viewsTableColumnsStorageKey,
  writeViewsTableColumnVisibility,
} from '@/app/views/_helpers/views-table-columns-storage';

const USER_ID = 'user-views-columns-1';
const STORAGE_KEY = viewsTableColumnsStorageKey(USER_ID);

describe('views-table-columns-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults when nothing is stored or user is missing', () => {
    expect(readViewsTableColumnVisibility(USER_ID)).toEqual(
      DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY
    );
    expect(readViewsTableColumnVisibility(undefined)).toEqual(
      DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY
    );
  });

  it('persists visibility and forces title on', () => {
    writeViewsTableColumnVisibility(USER_ID, {
      ...DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
      description: false,
      path: false,
      title: false,
      actions: false,
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.description).toBe(false);
    expect(stored.path).toBe(false);
    expect(stored.title).toBe(true);
    expect(stored.actions).toBe(false);

    const read = readViewsTableColumnVisibility(USER_ID);
    expect(read.description).toBe(false);
    expect(read.title).toBe(true);
    expect(read.actions).toBe(false);
  });

  it('skips writes without a user id', () => {
    writeViewsTableColumnVisibility(null, {
      ...DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
      description: false,
    });
    expect(localStorage).toHaveLength(0);
  });

  it('normalizes unknown keys and non-booleans', () => {
    expect(
      normalizeViewsTableColumnVisibility({
        description: false,
        nonsense: false,
        path: 'yes',
      } as never).description
    ).toBe(false);
    expect(
      normalizeViewsTableColumnVisibility({
        description: false,
        nonsense: false,
      } as never).nonsense
    ).toBeUndefined();
  });

  it('detects customized column visibility vs defaults', () => {
    expect(
      hasCustomViewsTableColumnVisibility(DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY)
    ).toBe(false);
    expect(
      hasCustomViewsTableColumnVisibility({
        ...DEFAULT_VIEWS_TABLE_COLUMN_VISIBILITY,
        description: false,
      })
    ).toBe(true);
  });
});
