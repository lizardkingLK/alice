import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import {
  createWorkItemAiProposalToken,
  verifyWorkItemAiProposalToken,
  WorkItemAiProposalTokenError,
  hashProposalTitle,
  hashProposalDescription,
} from '../../src/routes/api/work-items/work-item-ai-proposal-token';

describe('workItemAiProposalToken', () => {
  const userId = 'a1111111-1111-4111-8111-111111111111';
  const workItemId = 'b2222222-2222-4222-8222-222222222222';
  const title = 'Proposed concise title';
  const description = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
  };
  const baseUpdatedAt = '2026-11-10T09:00:00.000Z';

  it('signs and verifies a valid proposal token', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    const verified = verifyWorkItemAiProposalToken(token, {
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(verified.userId).toBe(userId);
    expect(verified.workItemId).toBe(workItemId);
    expect(verified.titleHash).toBe(hashProposalTitle(title));
    expect(verified.descriptionHash).toBe(hashProposalDescription(description));
    expect(verified.baseUpdatedAt).toBe(baseUpdatedAt);
  });

  it('rejects an expired token', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
      ttlMs: -1_000,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description,
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description,
        baseUpdatedAt,
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe('expired');
    }
  });

  it('rejects when userId does not match', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId: 'c3333333-3333-4333-8333-333333333333',
        workItemId,
        title,
        description,
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId: 'c3333333-3333-4333-8333-333333333333',
        workItemId,
        title,
        description,
        baseUpdatedAt,
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe('user_mismatch');
    }
  });

  it('rejects when workItemId does not match', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId: 'c3333333-3333-4333-8333-333333333333',
        title,
        description,
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId: 'c3333333-3333-4333-8333-333333333333',
        title,
        description,
        baseUpdatedAt,
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe('item_mismatch');
    }
  });

  it('rejects tampered title', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title: 'Tampered title',
        description,
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title: 'Tampered title',
        description,
        baseUpdatedAt,
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe(
        'content_mismatch'
      );
    }
  });

  it('rejects tampered description', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description: { type: 'doc', content: [] },
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description: { type: 'doc', content: [] },
        baseUpdatedAt,
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe(
        'content_mismatch'
      );
    }
  });

  it('rejects stale work item version', () => {
    const token = createWorkItemAiProposalToken({
      userId,
      workItemId,
      title,
      description,
      baseUpdatedAt,
    });

    expect(() =>
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description,
        baseUpdatedAt: '2026-11-10T10:00:00.000Z',
      })
    ).toThrowError(WorkItemAiProposalTokenError);

    try {
      verifyWorkItemAiProposalToken(token, {
        userId,
        workItemId,
        title,
        description,
        baseUpdatedAt: '2026-11-10T10:00:00.000Z',
      });
    } catch (err) {
      expect((err as WorkItemAiProposalTokenError).code).toBe('stale');
    }
  });

  it('rejects malformed token string', () => {
    expect(() =>
      verifyWorkItemAiProposalToken('not.a.valid.token', {
        userId,
        workItemId,
        title,
        description,
        baseUpdatedAt,
      })
    ).toThrowError(WorkItemAiProposalTokenError);
  });
});
