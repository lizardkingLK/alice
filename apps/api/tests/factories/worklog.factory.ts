import type { WorkLogListRow } from '@repo/types';
import { TEST_USER } from './user.fixture';

export function createWorkLogListRow(
  overrides: Partial<WorkLogListRow> = {}
): WorkLogListRow {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    work_item_id: '22222222-2222-4222-8222-222222222222',
    user_id: TEST_USER.id,
    logged_hours: 2.5,
    logged_at: new Date('2026-08-01T00:00:00.000Z'),
    comment: 'Implemented API versioning',
    user: TEST_USER,
    ...overrides,
  };
}
