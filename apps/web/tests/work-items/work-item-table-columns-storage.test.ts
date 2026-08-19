import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  WORK_ITEM_TABLE_COLUMNS_COOKIE,
  countVisibleWorkItemTableColumns,
  encodeWorkItemTableColumnVisibilityCookie,
  hasCustomWorkItemTableColumnVisibility,
  normalizeWorkItemTableColumnVisibility,
  parseWorkItemTableColumnVisibilityCookie,
  readWorkItemTableColumnVisibility,
  writeWorkItemTableColumnVisibility,
  listWorkItemTableColumnOptions,
} from '@/app/work-items/_helpers/work-item-table-columns-storage';

const USER_ID = 'user-columns-1';
const STORAGE_KEY = `alice:work-item-table-columns:v1:${USER_ID}`;

describe('work-item-table-columns-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${WORK_ITEM_TABLE_COLUMNS_COOKIE}=; path=/; max-age=0`;
  });

  it('defaults to today’s columns when nothing is stored', () => {
    expect(readWorkItemTableColumnVisibility(USER_ID)).toEqual(
      DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
    );
    expect(readWorkItemTableColumnVisibility(undefined)).toEqual(
      DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
    );
  });

  it('persists visibility and forces required columns on', () => {
    writeWorkItemTableColumnVisibility(USER_ID, {
      ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
      labels: true,
      title: false,
      actions: false,
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.labels).toBe(true);
    expect(stored.title).toBe(true);
    expect(stored.actions).toBe(false);

    const read = readWorkItemTableColumnVisibility(USER_ID);
    expect(read.labels).toBe(true);
    expect(read.title).toBe(true);
    expect(read.actions).toBe(false);
  });

  it('mirrors visibility into a cookie for SSR bootstrap', () => {
    writeWorkItemTableColumnVisibility(USER_ID, {
      ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
      labels: true,
      type: false,
    });

    expect(document.cookie).toContain(WORK_ITEM_TABLE_COLUMNS_COOKIE);
    const raw = document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${WORK_ITEM_TABLE_COLUMNS_COOKIE}=`))
      ?.slice(WORK_ITEM_TABLE_COLUMNS_COOKIE.length + 1);
    const parsed = parseWorkItemTableColumnVisibilityCookie(raw);
    expect(parsed.labels).toBe(true);
    expect(parsed.type).toBe(false);
    expect(parsed.title).toBe(true);
  });

  it('round-trips cookie encode/parse', () => {
    const visibility = normalizeWorkItemTableColumnVisibility({
      labels: true,
      sprint: true,
    });
    const encoded = encodeWorkItemTableColumnVisibilityCookie(visibility);
    expect(parseWorkItemTableColumnVisibilityCookie(encoded)).toEqual(
      visibility
    );
  });

  it('normalizes corrupt and unknown keys', () => {
    expect(normalizeWorkItemTableColumnVisibility('"yes"')).toEqual(
      DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
    );
    expect(
      normalizeWorkItemTableColumnVisibility({
        labels: true,
        nonsense: false,
        type: 'yes',
      }).labels
    ).toBe(true);
    expect(
      normalizeWorkItemTableColumnVisibility({
        labels: true,
        nonsense: false,
      }).nonsense
    ).toBeUndefined();
  });

  it('still writes the cookie without a user id', () => {
    writeWorkItemTableColumnVisibility(null, {
      ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
      labels: true,
    });
    expect(localStorage).toHaveLength(0);
    expect(document.cookie).toContain(WORK_ITEM_TABLE_COLUMNS_COOKIE);
  });

  it('omits project from dialog options when project is locked', () => {
    expect(
      listWorkItemTableColumnOptions({ isProjectLocked: true })
    ).not.toContain('project');
    expect(
      listWorkItemTableColumnOptions({ isProjectLocked: false })
    ).toContain('project');
  });

  it('counts visible columns for skeleton placeholders', () => {
    expect(
      countVisibleWorkItemTableColumns(
        DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
      )
    ).toBe(7);
    expect(
      countVisibleWorkItemTableColumns({
        title: true,
        actions: true,
        type: false,
        status: false,
        priority: false,
        assignee: false,
        due_date: false,
        project: false,
        sprint: false,
        reporter: false,
        story_points: false,
        labels: false,
      })
    ).toBe(2);
  });

  it('detects customized column visibility vs defaults', () => {
    expect(
      hasCustomWorkItemTableColumnVisibility(
        DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
      )
    ).toBe(false);
    expect(
      hasCustomWorkItemTableColumnVisibility({
        ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
        labels: true,
      })
    ).toBe(true);
  });
});
