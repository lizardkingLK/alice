import { getResponse } from '@/lib/api/api-fetch.helper';
import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getResponse', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('preserves a stable application error code from a failed response', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: 'You do not have permission to perform this board movement.',
            code: BOARD_MOVE_FORBIDDEN_CODE,
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    await expect(
      getResponse('/api/work-items/item-1', 'token')
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: BOARD_MOVE_FORBIDDEN_CODE,
    });
  });

  it('surfaces Zod treeify messages nested under array items', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              errors: [],
              properties: {
                config: {
                  errors: [],
                  properties: {
                    workflows: {
                      errors: [],
                      items: [
                        {
                          errors: [],
                          properties: {
                            graph: {
                              errors: [],
                              properties: {
                                edges: {
                                  errors: [],
                                  items: [
                                    null,
                                    {
                                      errors: [],
                                      properties: {
                                        resolutionPresetId: {
                                          errors: [
                                            'State "todo" requires escalation — outbound edge must reference a resolution preset',
                                          ],
                                        },
                                      },
                                    },
                                  ],
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    await expect(
      getResponse('/api/projects/p1/workflow-config', 'token', {
        method: 'PUT',
        body: '{}',
      })
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message:
        'State "todo" requires escalation — outbound edge must reference a resolution preset',
    });
  });
});
