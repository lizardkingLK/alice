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
      getResponse('/api/workItems/item-1', 'token')
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: BOARD_MOVE_FORBIDDEN_CODE,
    });
  });
});
