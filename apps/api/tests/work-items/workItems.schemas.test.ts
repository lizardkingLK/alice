import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUpdateWorkItemBodySchema } from '../../src/routes/api/workItems/workItems.schemas';

const validCore = {
  title: 'Labeled item',
  project_id: '11111111-1111-4111-8111-111111111111',
  type: 'Task' as const,
  assignee_id: null,
  due_date: null,
};

describe('work item labels schema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'));
  });

  it('accepts and normalizes labels arrays', () => {
    const parsed = createUpdateWorkItemBodySchema.safeParse({
      ...validCore,
      labels: ['  Alpha ', 'Beta', 'Alpha'],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.labels).toEqual(['Alpha', 'Beta']);
    }
  });

  it('accepts labels JSON strings', () => {
    const parsed = createUpdateWorkItemBodySchema.safeParse({
      ...validCore,
      labels: '["Mobile"]',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.labels).toEqual(['Mobile']);
    }
  });

  it('rejects invalid labels payloads', () => {
    const parsed = createUpdateWorkItemBodySchema.safeParse({
      ...validCore,
      labels: [1, 2],
    });

    expect(parsed.success).toBe(false);
  });
});
