import { describe, expect, it, vi, beforeEach } from 'vitest';
import { expandShareRecipients } from '@repo/types';

describe('savedViews share recipient expansion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops the owner and empty ids', () => {
    expect(
      expandShareRecipients({
        ownerId: 'u-owner',
        candidateIds: ['u-owner', 'u-1', 'u-1', 'u-2', ''],
      }).sort()
    ).toEqual(['u-1', 'u-2']);
  });
});
