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

  it('aborts a request when its configured timeout expires', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test');
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(requestSignal?.reason),
            { once: true }
          );
        });
      })
    );

    await expect(
      getResponse('/api/v1/sprints/sprint-1/estimates', 'token', {
        method: 'POST',
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({ name: 'BackendUnreachableError' });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('returns successful binary responses as blobs', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('xlsx-bytes', {
          status: 200,
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        })
      )
    );

    const blob = await getResponse<Blob>('/api/worklogs/template', 'token', {
      responseType: 'blob',
    });

    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe('xlsx-bytes');
  });

  it('keeps structured Excel row errors on ApiError details', async () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'Excel validation failed.',
            errors: [
              {
                row_number: 7,
                field: 'End Date/Time',
                message: 'End must be later than start.',
              },
            ],
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    await expect(
      getResponse('/api/worklogs/preview', 'token', {
        method: 'POST',
      })
    ).rejects.toMatchObject({
      status: 400,
      details: [
        {
          row_number: 7,
          field: 'End Date/Time',
          message: 'End must be later than start.',
        },
      ],
    });
  });
});
