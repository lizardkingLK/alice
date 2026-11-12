import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: apiFetchMock,
}));

import { generateWorkItemAiProposals } from '@/app/work-items/_services/work-item-ai-proposals.client';

describe('generateWorkItemAiProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({
      data: { suggestions: [] },
      error: null,
    });
  });

  it('allows the API to return its structured generation error before client abort', async () => {
    const workItemId = '99999999-9999-4999-8999-999999999999';
    const agentId = '33333333-3333-4333-8333-333333333333';
    const commentId = '44444444-4444-4444-8444-444444444444';

    await generateWorkItemAiProposals(workItemId, {
      agentId,
      commentIds: [commentId],
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/v1/work-items/${workItemId}/ai-proposals`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ agentId, commentIds: [commentId] }),
        timeoutMs: 30_000,
      })
    );
  });
});
