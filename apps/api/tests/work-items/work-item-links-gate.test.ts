import { describe, expect, it } from 'vitest';
import { canonicalWorkItemLinkPair } from '@repo/types';

describe('work item links gate helpers', () => {
  it('canonical pair is commutative', () => {
    const left = '11111111-1111-4111-8111-111111111111';
    const right = '22222222-2222-4222-8222-222222222222';
    expect(canonicalWorkItemLinkPair(left, right)).toEqual(
      canonicalWorkItemLinkPair(right, left)
    );
  });
});
