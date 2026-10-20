import { describe, expect, it } from 'vitest';
import {
  buildHierarchyPageRpcArgs,
  parseHierarchyPageRpcPayload,
} from '@/app/work-items/_helpers/work-item-hierarchy-page-rpc';

describe('parseHierarchyPageRpcPayload', () => {
  it('parses a browse page payload', () => {
    const parsed = parseHierarchyPageRpcPayload({
      mode: 'tree',
      page: 2,
      limit: 100,
      total_count: 250,
      total_pages: 3,
      focus_id: null,
      table_ids: ['epic-1'],
      page_ids: ['epic-1', 's1', 's2'],
      panel_ids: [],
      match_ids: [],
      ancestors_by_id: {
        s1: [
          {
            id: 'epic-1',
            type: 'Epic',
            title: 'Epic',
            parent_id: null,
          },
        ],
      },
    });

    expect(parsed?.mode).toBe('tree');
    expect(parsed?.page_ids).toEqual(['epic-1', 's1', 's2']);
    expect(parsed?.ancestors_by_id.s1?.[0]?.id).toBe('epic-1');
  });

  it('returns null for garbage', () => {
    expect(parseHierarchyPageRpcPayload(null)).toBeNull();
    expect(parseHierarchyPageRpcPayload('x')).toBeNull();
  });
});

describe('buildHierarchyPageRpcArgs', () => {
  it('maps sprint null to p_sprint_is_null', () => {
    const args = buildHierarchyPageRpcArgs({
      page: 1,
      pageSize: 100,
      filters: { sprintId: null, recordStatus: 'active' },
    });
    expect(args.p_sprint_is_null).toBe(true);
    expect(args.p_sprint_id).toBeNull();
  });
});
