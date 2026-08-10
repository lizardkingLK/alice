import { describe, expect, it } from 'vitest';
import { parseViewsListTab } from '@/lib/search-params';

describe('parseViewsListTab', () => {
  it('accepts shared and archived', () => {
    expect(parseViewsListTab('shared')).toBe('shared');
    expect(parseViewsListTab('archived')).toBe('archived');
  });

  it('defaults everything else to mine', () => {
    expect(parseViewsListTab(undefined)).toBe('mine');
    expect(parseViewsListTab(null)).toBe('mine');
    expect(parseViewsListTab('')).toBe('mine');
    expect(parseViewsListTab('mine')).toBe('mine');
    expect(parseViewsListTab('other')).toBe('mine');
  });
});
