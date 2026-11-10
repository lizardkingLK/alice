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

const proposalService = {
  generate: generateMock,
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
    generateMock.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(
              new WorkItemAiProposalError(
                'cancelled',
                'AI work-item suggestion generation was cancelled.'
              )
            );
          });
        })
    );

    await withMountedRouter('/api/v1/work-items', router, async (baseUrl) => {
      const controller = new AbortController();
      const reqPromise = postProposal(baseUrl, { signal: controller.signal });
      controller.abort();

      await expect(reqPromise).rejects.toThrow();
    });
  });
});
