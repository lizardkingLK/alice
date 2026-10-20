import { describe, expect, it } from 'vitest';
import { canonicalWorkItemLinkPair } from '@repo/types';

describe('canonicalWorkItemLinkPair', () => {
  it('orders the lower uuid as source', () => {
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(canonicalWorkItemLinkPair(a, b)).toEqual({
      sourceId: a,
      targetId: b,
    });
    expect(canonicalWorkItemLinkPair(b, a)).toEqual({
      sourceId: a,
      targetId: b,
    });
  });
});
