import { describe, expect, it } from 'vitest';
import {
  applyQueryFilterParam,
  normalizeQueryFilterValue,
  QUERY_FILTER_ALL_VALUE,
} from '@/hooks/use-query-filter';

describe('query filter helpers', () => {
  it('normalizes empty and all sentinels', () => {
    expect(normalizeQueryFilterValue('')).toBe(QUERY_FILTER_ALL_VALUE);
    expect(normalizeQueryFilterValue('all')).toBe(QUERY_FILTER_ALL_VALUE);
    expect(normalizeQueryFilterValue('story')).toBe('story');
  });

  it('writes and clears filter params', () => {
    const params = new URLSearchParams('type=Story&page=2');
    applyQueryFilterParam(params, 'type', 'all');
    expect(params.get('type')).toBeNull();

    applyQueryFilterParam(params, 'type', 'Task');
    expect(params.get('type')).toBe('Task');
  });
});
