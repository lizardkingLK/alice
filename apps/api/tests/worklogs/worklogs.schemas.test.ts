import { describe, expect, it } from 'vitest';
import { createWorkLogSchema } from '@repo/types';

const WORK_ITEM_ID = '22222222-2222-4222-8222-222222222222';

describe('work log v1 input schemas', () => {
  it('accepts create work log payloads', () => {
    const parsed = createWorkLogSchema.safeParse({
      work_item_id: WORK_ITEM_ID,
      logged_hours: 2.5,
      logged_at: '2026-08-01',
      comment: 'Shipped',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid create work log payloads', () => {
    const parsed = createWorkLogSchema.safeParse({
      work_item_id: WORK_ITEM_ID,
      logged_hours: 0,
    });

    expect(parsed.success).toBe(false);
  });
});
