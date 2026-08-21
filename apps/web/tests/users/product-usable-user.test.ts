import { describe, expect, it } from 'vitest';
import { isProductUsableUser } from '@repo/types';

describe('isProductUsableUser', () => {
  it('requires kill switch on and membership active', () => {
    expect(
      isProductUsableUser({ active: true, membership_status: 'active' })
    ).toBe(true);
    expect(
      isProductUsableUser({ active: true, membership_status: 'pending' })
    ).toBe(false);
    expect(
      isProductUsableUser({ active: false, membership_status: 'active' })
    ).toBe(false);
    expect(
      isProductUsableUser({ active: false, membership_status: 'pending' })
    ).toBe(false);
  });
});
