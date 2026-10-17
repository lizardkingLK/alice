import { describe, expect, it } from 'vitest';
import {
  mergeWorkItemServerRow,
  replaceWorkItemInList,
} from '@/app/work-items/_helpers/work-item-merge-server-row';
import { workItemFactory } from '../factories/workItem.factory';

describe('work-item-merge-server-row', () => {
  it('merges server fields and keeps assignee when omitted', () => {
    const current = workItemFactory.build({
      title: 'Old',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    const updated = {
      ...current,
      title: 'New',
      updated_at: '2026-10-02T00:00:00.000Z',
      assignee: null,
    };

    const merged = mergeWorkItemServerRow(current, updated);
    expect(merged.title).toBe('New');
    expect(merged.updated_at).toBe('2026-10-02T00:00:00.000Z');
    expect(merged.assignee?.name).toBe(current.assignee?.name);
  });

  it('replaces a matching list row by id', () => {
    const a = workItemFactory.build({ id: 'a', title: 'A' });
    const b = workItemFactory.build({ id: 'b', title: 'B' });
    const next = replaceWorkItemInList([a, b], {
      ...b,
      title: 'B2',
      updated_at: '2026-10-03T00:00:00.000Z',
    });
    expect(next[0]?.title).toBe('A');
    expect(next[1]?.title).toBe('B2');
  });
});
