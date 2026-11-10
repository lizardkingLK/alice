import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

vi.mock('../../src/middlewares/auth', () => {
  return {
    requireApiAuth: (
      req: { headers: { authorization?: string }; userId?: string },
      res: { status: (status: number) => { json: (body: unknown) => void } },
      next: () => void
    ) => {
      if (req.headers.authorization !== 'Bearer valid-token') {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      req.userId = '55555555-5555-4555-8555-555555555555';
      next();
    },
  };
});

import { createWorkItemAiProposalsRouter } from '../../src/routes/api/work-items/work-item-ai-proposals.route';
import { WorkItemAiProposalTokenError } from '../../src/routes/api/work-items/work-item-ai-proposal-token';
import {
  WorkItemAiProposalError,
  type WorkItemAiProposalService,
} from '../../src/routes/api/work-items/work-item-ai-proposals.service';
import { WorkItemAccessError } from '../../src/routes/api/work-items/work-items.errors';
import { CommentAccessError } from '../../src/routes/api/comments/comments.errors';
import { ChatAgentRuntimeAccessError } from '../../src/routes/api/chat/chat-agent-runtime';
import { withMountedRouter } from '../helpers/route-test.harness';

const WORK_ITEM_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = '33333333-3333-4333-8333-333333333333';
const COMMENT_ID = '44444444-4444-4444-8444-444444444444';

const validSuggestions = {
  suggestions: [
    {
      title: 'First suggested title',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First description content' }],
          },
        ],
      },
    },
    {
      title: 'Second suggested title',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second description content' }],
          },
        ],
      },
    },
  ],
};

const generateMock = vi.fn();
const applyMock = vi.fn();

const proposalService = {
  generate: generateMock,
  apply: applyMock,
} as unknown as WorkItemAiProposalService;

const router = createWorkItemAiProposalsRouter({ proposalService });

function postProposal(
  baseUrl: string,
  options: {
    mountPath?: '/api/v1/work-items' | '/api/work-items';
    workItemId?: string;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
  } = {}
) {
  const {
    mountPath = '/api/v1/work-items',
    workItemId = WORK_ITEM_ID,
    body = {
      agentId: AGENT_ID,
      commentIds: [COMMENT_ID],
      context: 'Focus on performance',
    },
    token = 'valid-token',
    signal,
  } = options;

  return fetch(`${baseUrl}${mountPath}/${workItemId}/ai-proposals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
}

describe('POST /api/v1/work-items/:id/ai-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateMock.mockResolvedValue(validSuggestions);
  });

  it('returns suggestions for a valid request and handles mention format', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl, {
        body: {
          agentId: `agent:${AGENT_ID}`,
          commentIds: [COMMENT_ID],
          context: 'Clarify deliverables',
        },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        data: validSuggestions,
        error: null,
      });
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workItemId: WORK_ITEM_ID,
          agentId: AGENT_ID,
          commentIds: [COMMENT_ID],
          context: 'Clarify deliverables',
        })
      );
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl, { token: null });
      expect(response.status).toBe(401);
      expect(generateMock).not.toHaveBeenCalled();
    });
  });

  it('rejects invalid work item ID parameter with 400', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl, {
        workItemId: 'not-a-valid-uuid',
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toBe('Invalid work item id');
      expect(generateMock).not.toHaveBeenCalled();
    });
  });

  it.each([
    { name: 'missing agentId', body: { commentIds: [] } },
    { name: 'invalid agentId uuid', body: { agentId: 'bad-agent-id' } },
    {
      name: 'duplicate commentIds',
      body: { agentId: AGENT_ID, commentIds: [COMMENT_ID, COMMENT_ID] },
    },
    {
      name: 'too many comments (>12)',
      body: {
        agentId: AGENT_ID,
        commentIds: Array.from(
          { length: 13 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
        ),
      },
    },
    {
      name: 'context exceeds 4000 chars',
      body: { agentId: AGENT_ID, context: 'a'.repeat(4001) },
    },
    {
      name: 'extra disallowed fields',
      body: { agentId: AGENT_ID, extraField: 'not allowed' },
    },
  ])('rejects invalid body ($name) with 400', async ({ body }) => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl, { body });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
      expect(generateMock).not.toHaveBeenCalled();
    });
  });

  it('returns 403 when work-item access is denied', async () => {
    generateMock.mockRejectedValue(new WorkItemAccessError());

    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.data).toBeNull();
    });
  });

  it('returns 403 when agent access is denied', async () => {
    generateMock.mockRejectedValue(new ChatAgentRuntimeAccessError());

    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.data).toBeNull();
    });
  });

  it('returns 403 when comment access is denied', async () => {
    generateMock.mockRejectedValue(new CommentAccessError());

    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postProposal(baseUrl);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.data).toBeNull();
    });
  });

  it.each([
    {
      error: new WorkItemAiProposalError('not_found', 'Work item not found.'),
      expectedStatus: 404,
      expectedCode: 'not_found',
    },
    {
      error: new WorkItemAiProposalError(
        'invalid_context',
        'Comments must be active and belong to the requested work item.'
      ),
      expectedStatus: 400,
      expectedCode: 'invalid_context',
    },
    {
      error: new WorkItemAiProposalError(
        'invalid_response',
        'The AI provider returned invalid work-item suggestions.'
      ),
      expectedStatus: 502,
      expectedCode: 'invalid_response',
    },
    {
      error: new WorkItemAiProposalError(
        'generation_failed',
        'AI work-item suggestion generation failed.'
      ),
      expectedStatus: 502,
      expectedCode: 'generation_failed',
    },
    {
      error: new WorkItemAiProposalError(
        'configuration',
        'AI work-item suggestions are not configured.'
      ),
      expectedStatus: 503,
      expectedCode: 'configuration',
    },
    {
      error: new WorkItemAiProposalError(
        'timeout',
        'AI work-item suggestion generation timed out.'
      ),
      expectedStatus: 504,
      expectedCode: 'timeout',
    },
    {
      error: new WorkItemAiProposalError(
        'cancelled',
        'AI work-item suggestion generation was cancelled.'
      ),
      expectedStatus: 408,
      expectedCode: 'cancelled',
    },
  ])(
    'maps $error.code to status $expectedStatus',
    async ({ error, expectedStatus, expectedCode }) => {
      generateMock.mockRejectedValue(error);

      await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
        const response = await postProposal(baseUrl);
        expect(response.status).toBe(expectedStatus);
        const json = await response.json();
        expect(json.data).toBeNull();
        expect(json.code).toBe(expectedCode);
      });
    }
  );

  it('aborts service generation when client disconnects', async () => {
    let observedSignal: AbortSignal | undefined;
    generateMock.mockImplementation(({ signal }: { signal: AbortSignal }) => {
      observedSignal = signal;
      return new Promise((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            reject(
              new WorkItemAiProposalError(
                'cancelled',
                'AI work-item suggestion generation was cancelled.'
              )
            );
          },
          { once: true }
        );
      });
    });

    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const controller = new AbortController();
      const reqPromise = postProposal(baseUrl, { signal: controller.signal });
      await vi.waitFor(() => expect(observedSignal).toBeDefined());
      controller.abort();

      await expect(reqPromise).rejects.toMatchObject({ name: 'AbortError' });
      await vi.waitFor(() => expect(observedSignal?.aborted).toBe(true));
    });
  });
});

function postApply(
  baseUrl: string,
  options: {
    mountPath?: '/api/v1/work-items' | '/api/work-items';
    workItemId?: string;
    body?: unknown;
    token?: string | null;
  } = {}
) {
  const {
    mountPath = '/api/v1/work-items',
    workItemId = WORK_ITEM_ID,
    body = {
      token: 'valid-signed-token',
      title: 'New suggested title',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'New description' }],
          },
        ],
      },
      expectedUpdatedAt: '2026-11-10T09:00:00.000Z',
    },
    token = 'valid-token',
  } = options;

  return fetch(`${baseUrl}${mountPath}/${workItemId}/ai-proposals/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/v1/work-items/:id/ai-proposals/apply', () => {
  const appliedWorkItem = {
    id: WORK_ITEM_ID,
    title: 'New suggested title',
    description: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'New' }] },
      ],
    },
    updated_at: '2026-11-10T09:05:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    applyMock.mockResolvedValue(appliedWorkItem);
  });

  it('returns 200 and updated work item for a valid apply request', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        data: appliedWorkItem,
        error: null,
      });
      expect(applyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: '55555555-5555-4555-8555-555555555555',
          workItemId: WORK_ITEM_ID,
          token: 'valid-signed-token',
          title: 'New suggested title',
          expectedUpdatedAt: '2026-11-10T09:00:00.000Z',
        })
      );
    });
  });

  it('returns 401 when request is unauthenticated', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl, { token: null });
      expect(response.status).toBe(401);
    });
  });

  it('returns 400 when workItemId is not a valid UUID', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl, { workItemId: 'invalid-id' });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toBe('Invalid work item id');
    });
  });

  it('returns 400 when body fails schema validation', async () => {
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl, {
        body: {
          token: '',
          title: '',
        },
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toBeDefined();
    });
  });

  it('returns 403 when user is not a project member', async () => {
    applyMock.mockRejectedValue(new WorkItemAccessError());
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toContain("You're not a member of this project.");
    });
  });

  it('returns 403 when proposal token user does not match', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalTokenError(
        'user_mismatch',
        'Suggestion proposal token does not match the current user.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.error).toContain('does not match the current user');
      expect(json.code).toBe('user_mismatch');
    });
  });

  it('returns 400 when proposal token is tampered or invalid', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalTokenError(
        'invalid_token',
        'Invalid work-item proposal confirmation token.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('invalid_token');
    });
  });

  it('returns 400 when proposal token is expired', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalTokenError(
        'expired',
        'This suggestion proposal has expired. Request new suggestions.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('expired');
    });
  });

  it('returns 409 when proposal token version is stale', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalTokenError(
        'stale',
        'The work item has been modified since this suggestion was generated.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('stale');
    });
  });

  it('returns 400 when work item is Done', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalError(
        'done',
        'Cannot apply suggestions to a completed work item.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('done');
    });
  });

  it('returns 400 when work item is archived', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalError(
        'archived',
        'Cannot apply suggestions to an archived work item.'
      )
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('archived');
    });
  });

  it('returns 404 when work item is not found', async () => {
    applyMock.mockRejectedValue(
      new WorkItemAiProposalError('not_found', 'Work item not found.')
    );
    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const response = await postApply(baseUrl);
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.data).toBeNull();
      expect(json.code).toBe('not_found');
    });
  });
});
