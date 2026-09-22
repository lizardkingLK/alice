import { beforeEach, describe, expect, it, vi } from 'vitest';

const AUTHENTICATED_USER_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('../../src/middlewares/auth', () => ({
  requireApiAuth: (
    req: { headers: { authorization?: string }; userId?: string },
    res: {
      status: (status: number) => { json: (body: unknown) => void };
    },
    next: () => void
  ) => {
    if (req.headers.authorization !== 'Bearer valid-token') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.userId = AUTHENTICATED_USER_ID;
    next();
  },
}));

import { createPusherRouter } from '../../src/routes/api/pusher/pusher.route';
import {
  PusherService,
  PusherServiceError,
} from '../../src/routes/api/pusher/pusher.service';
import { withMountedRouter } from '../helpers/route-test.harness';

const authorizePresenceChannelMock = vi.fn();
const pusherService = {
  authorizePresenceChannel: authorizePresenceChannelMock,
} as unknown as PusherService;
const pusherRouter = createPusherRouter({ pusherService });

async function requestAuthorization(
  baseUrl: string,
  body: unknown,
  authorization: string | null = 'Bearer valid-token'
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(`${baseUrl}/api/pusher/auth`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const responseBody = await response.json();
  return { response, body: responseBody };
}

describe('Pusher authorization route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the raw authorization and ignores a browser-provided user_id', async () => {
    const authorization = {
      auth: 'mock-key:signature',
      channel_data: JSON.stringify({ user_id: AUTHENTICATED_USER_ID }),
    };
    authorizePresenceChannelMock.mockResolvedValue(authorization);

    await withMountedRouter('/api/pusher', pusherRouter, async (baseUrl) => {
      const result = await requestAuthorization(baseUrl, {
        socket_id: '123.456',
        channel_name: 'presence-workspace',
        user_id: 'browser-controlled-user-id',
      });

      expect(result.response.status).toBe(200);
      expect(result.body).toEqual(authorization);
      expect(result.body).not.toHaveProperty('data');
      expect(authorizePresenceChannelMock).toHaveBeenCalledWith(
        AUTHENTICATED_USER_ID,
        '123.456',
        'presence-workspace'
      );
    });
  });

  it.each([
    [{ channel_name: 'presence-workspace' }, 'missing socket_id'],
    [{ socket_id: '', channel_name: 'presence-workspace' }, 'empty socket_id'],
    [{ socket_id: '123.456' }, 'missing channel_name'],
    [{ socket_id: '123.456', channel_name: '' }, 'empty channel_name'],
  ])('returns 400 for %s (%s)', async (invalidBody, _label) => {
    await withMountedRouter('/api/pusher', pusherRouter, async (baseUrl) => {
      const result = await requestAuthorization(baseUrl, invalidBody);

      expect(result.response.status).toBe(400);
      expect(result.body).toHaveProperty('error');
      expect(authorizePresenceChannelMock).not.toHaveBeenCalled();
    });
  });

  it.each([null, 'Bearer invalid-token'])(
    'returns 401 for missing or invalid bearer auth (%s)',
    async (authorization) => {
      await withMountedRouter('/api/pusher', pusherRouter, async (baseUrl) => {
        const result = await requestAuthorization(
          baseUrl,
          {
            socket_id: '123.456',
            channel_name: 'presence-workspace',
          },
          authorization
        );

        expect(result.response.status).toBe(401);
        expect(result.body).toEqual({ error: 'Unauthorized' });
        expect(authorizePresenceChannelMock).not.toHaveBeenCalled();
      });
    }
  );

  it('returns 403 when the service rejects the channel or user', async () => {
    authorizePresenceChannelMock.mockRejectedValue(
      new PusherServiceError('Forbidden', 403)
    );

    await withMountedRouter('/api/pusher', pusherRouter, async (baseUrl) => {
      const result = await requestAuthorization(baseUrl, {
        socket_id: '123.456',
        channel_name: 'private-test',
      });

      expect(result.response.status).toBe(403);
      expect(result.body).toEqual({ error: 'Forbidden' });
    });
  });

  it('sanitizes unexpected Pusher SDK errors', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    authorizePresenceChannelMock.mockRejectedValue(
      new Error('mock-pusher-secret mock-pusher-key')
    );

    await withMountedRouter('/api/pusher', pusherRouter, async (baseUrl) => {
      const result = await requestAuthorization(baseUrl, {
        socket_id: '123.456',
        channel_name: 'presence-workspace',
      });

      expect(result.response.status).toBe(500);
      expect(result.body).toEqual({
        error: 'Failed to authorize Pusher channel.',
      });
      expect(JSON.stringify(result.body)).not.toContain('mock-pusher');
      expect(consoleError).toHaveBeenCalledWith(
        'error. pusher authorization failed'
      );
    });
  });
});
