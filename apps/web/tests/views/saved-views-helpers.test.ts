import { describe, expect, it } from 'vitest';
import {
  buildSavedViewHref,
  expandShareRecipients,
  normalizeSavedViewSearch,
  uniqueSavedViewIdsFromShares,
} from '@repo/types';

describe('saved-views helpers', () => {
  it('normalizes search without a leading question mark', () => {
    expect(normalizeSavedViewSearch('?project=1&type=Task')).toBe(
      'project=1&type=Task'
    );
    expect(normalizeSavedViewSearch('')).toBe('');
  });

  it('builds hrefs from pathname + search', () => {
    expect(buildSavedViewHref('/work-items', 'project=abc')).toBe(
      '/work-items?project=abc'
    );
    expect(buildSavedViewHref('/projects', '')).toBe('/projects');
  });

  it('expands share recipients excluding the owner and duplicates', () => {
    expect(
      expandShareRecipients({
        ownerId: 'owner',
        candidateIds: ['owner', 'a', 'b', 'a', ''],
      })
    ).toEqual(['a', 'b']);
  });

  it('dedupes share rows to view ids', () => {
    expect(
      uniqueSavedViewIdsFromShares([
        { view_id: 'a' },
        { view_id: 'b' },
        { view_id: 'a' },
      ])
    ).toEqual(['a', 'b']);
  });

  it('normalizes search when comparing saved view paths', () => {
    expect(normalizeSavedViewSearch('?a=1')).toBe('a=1');
    expect(normalizeSavedViewSearch('a=1')).toBe('a=1');
    expect(buildSavedViewHref('/work-items', 'a=1')).toBe('/work-items?a=1');
  });
});
