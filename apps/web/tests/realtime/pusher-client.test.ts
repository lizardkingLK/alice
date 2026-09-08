import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  constructor: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/lib/api/api-fetch.use.client', () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock('pusher-js', () => ({
  default: class MockPusher {
    disconnect = mocks.disconnect;

    constructor(key: string, options: unknown) {
      mocks.constructor(key, options);
    }
  },
}));

import { disconnectPusherClient, getPusherClient } from '@/lib/pusher/client';

/* eslint-disable no-unused-vars -- callback type params */
type PusherOptions = {
  cluster: string;
  forceTLS: boolean;
  channelAuthorization: {
    customHandler: (
      params: { socketId: string; channelName: string },
      callback: (error: Error | null, data: unknown) => void
    ) => void;
  };
};
/* eslint-enable no-unused-vars */

describe('frontend Pusher client', () => {
  beforeEach(() => {
    disconnectPusherClient();
    vi.clearAllMocks();
  });

  it('creates one TLS Pusher client per browser runtime', () => {
    const first = getPusherClient();
    const second = getPusherClient();

    expect(second).toBe(first);
    expect(mocks.constructor).toHaveBeenCalledTimes(1);
    expect(mocks.constructor).toHaveBeenCalledWith(
      'test-pusher-key',
      expect.objectContaining({
        cluster: 'mt1',
        forceTLS: true,
      })
    );
  });

  it('authorizes channels through apiFetch with Pusher request parameters', async () => {
    const authorization = {
      auth: 'test-pusher-key:signature',
      channel_data: '{"user_id":"user-1"}',
    };
    mocks.apiFetch.mockResolvedValue(authorization);
    getPusherClient();

    const options = mocks.constructor.mock.calls[0]?.[1] as PusherOptions;
    const callback = vi.fn();
    options.channelAuthorization.customHandler(
      { socketId: '123.456', channelName: 'presence-workspace' },
      callback
    );

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/pusher/auth', {
        method: 'POST',
        body: JSON.stringify({
          socket_id: '123.456',
          channel_name: 'presence-workspace',
        }),
      });
      expect(callback).toHaveBeenCalledWith(null, authorization);
    });
  });

  it('returns a sanitized callback error when authorization fails', async () => {
    mocks.apiFetch.mockRejectedValue(
      new Error('test secret must not reach Pusher callback')
    );
    getPusherClient();

    const options = mocks.constructor.mock.calls[0]?.[1] as PusherOptions;
    const callback = vi.fn();
    options.channelAuthorization.customHandler(
      { socketId: '123.456', channelName: 'presence-workspace' },
      callback
    );

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith(expect.any(Error), null);
    });
    const callbackError = callback.mock.calls[0]?.[0] as Error;
    expect(callbackError.message).toBe(
      'Realtime channel authorization failed.'
    );
  });
});
