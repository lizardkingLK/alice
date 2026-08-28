import type { ProfileDetailRow } from '@repo/types';

export function createProfileDetailRow(
  overrides: Partial<ProfileDetailRow> = {}
): ProfileDetailRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ada',
    email: 'ada@example.com',
    role: 'member',
    profile_picture: null,
    cover_picture: null,
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}
