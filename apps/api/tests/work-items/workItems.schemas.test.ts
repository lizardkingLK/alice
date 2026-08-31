import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkItemBodySchema,
  linkWorkItemGithubPrBodySchema,
  patchWorkItemBodySchema,
} from '@repo/types/api/v1';

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
    const parsed = createWorkItemBodySchema.safeParse({
      ...validCore,
      labels: ['  Alpha ', 'Beta', 'Alpha'],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.labels).toEqual(['Alpha', 'Beta']);
    }
  });

  it('accepts labels JSON strings', () => {
    const parsed = createWorkItemBodySchema.safeParse({
      ...validCore,
      labels: '["Mobile"]',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.labels).toEqual(['Mobile']);
    }
  });

  it('rejects invalid labels payloads', () => {
    const parsed = createWorkItemBodySchema.safeParse({
      ...validCore,
      labels: [1, 2],
    });

    expect(parsed.success).toBe(false);
  });
});

describe('linkWorkItemGithubPrBodySchema', () => {
  it('accepts full GitHub PR URLs', () => {
    const parsed = linkWorkItemGithubPrBodySchema.safeParse({
      prUrl: 'https://github.com/acme/app/pull/42',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts owner/repo/pull shorthand', () => {
    const parsed = linkWorkItemGithubPrBodySchema.safeParse({
      prUrl: 'acme/app/pull/42',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid PR URLs', () => {
    const parsed = linkWorkItemGithubPrBodySchema.safeParse({
      prUrl: 'https://gitlab.com/acme/app/-/merge_requests/1',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('patchWorkItemBodySchema', () => {
  it('accepts optimistic-lock force patch payloads', () => {
    const parsed = patchWorkItemBodySchema.safeParse({
      title: 'Updated title',
      expectedUpdatedAt: '2026-08-06T12:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
  });
});
