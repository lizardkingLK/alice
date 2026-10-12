import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORK_ITEM_ACTIVITY_LAYOUT,
  readWorkItemActivityLayout,
  workItemActivityLayoutStorageKey,
  writeWorkItemActivityLayout,
} from '@/app/work-items/_helpers/work-item-activity-layout-preference';

describe('work-item-activity-layout-preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to cards when unset, corrupt, or missing work item id', () => {
    expect(readWorkItemActivityLayout('wi-1')).toBe(
      DEFAULT_WORK_ITEM_ACTIVITY_LAYOUT
    );
    expect(readWorkItemActivityLayout(null)).toBe('cards');
    localStorage.setItem(workItemActivityLayoutStorageKey('wi-1'), '"nope"');
    expect(readWorkItemActivityLayout('wi-1')).toBe('cards');
  });

  it('persists layout per work item', () => {
    writeWorkItemActivityLayout('wi-1', 'timeline');
    writeWorkItemActivityLayout('wi-2', 'table');

    expect(readWorkItemActivityLayout('wi-1')).toBe('timeline');
    expect(readWorkItemActivityLayout('wi-2')).toBe('table');
    expect(
      JSON.parse(
        localStorage.getItem(workItemActivityLayoutStorageKey('wi-1')) ?? 'null'
      )
    ).toBe('timeline');

    writeWorkItemActivityLayout('wi-1', 'cards');
    expect(readWorkItemActivityLayout('wi-1')).toBe('cards');
    expect(readWorkItemActivityLayout('wi-2')).toBe('table');
  });

  it('ignores writes without a work item id', () => {
    writeWorkItemActivityLayout(undefined, 'timeline');
    expect(localStorage).toHaveLength(0);
  });
});
