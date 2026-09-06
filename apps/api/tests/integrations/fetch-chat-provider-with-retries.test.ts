import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import { fetchChatProviderWithRetries } from '../../src/routes/api/integrations/chat-providers/fetch-chat-provider-with-retries';

describe('fetchChatProviderWithRetries', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the response when the first attempt succeeds', async () => {
    const ok = new Response('{"ok":true}', { status: 200 });
    const fetchOnce = vi.fn(async () => ok);

    await expect(
      fetchChatProviderWithRetries({
        provider: 'test',
        providerLabel: 'Test',
        modelId: 'm1',
        messagesCount: 1,
        fetchOnce,
        resolveUserFacingError: () => null,
      })
    ).resolves.toBe(ok);

    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors then succeeds', async () => {
    vi.useFakeTimers();
    const fetchOnce = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('busy', { status: 503, statusText: 'Service Unavailable' })
      )
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const promise = fetchChatProviderWithRetries({
      provider: 'test',
      providerLabel: 'Test',
      modelId: 'm1',
      messagesCount: 2,
      fetchOnce,
      resolveUserFacingError: () => null,
      initialDelayMs: 10,
    });

    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });

  it('throws ChatProviderError when resolveUserFacingError returns a message', async () => {
    const fetchOnce = vi.fn(
      async () =>
        new Response('bad key', { status: 401, statusText: 'Unauthorized' })
    );

    await expect(
      fetchChatProviderWithRetries({
        provider: 'test',
        providerLabel: 'Test',
        modelId: 'm1',
        messagesCount: 1,
        fetchOnce,
        resolveUserFacingError: () => 'Fix your API key',
      })
    ).rejects.toMatchObject({
      name: 'ChatProviderError',
      statusCode: 400,
      message: 'Fix your API key',
    } satisfies Partial<ChatProviderError>);
  });

  it('throws rate-limit message after exhausting 429 retries', async () => {
    vi.useFakeTimers();
    const fetchOnce = vi.fn(
      async () =>
        new Response('slow down', {
          status: 429,
          statusText: 'Too Many Requests',
        })
    );

    const promise = fetchChatProviderWithRetries({
      provider: 'test',
      providerLabel: 'Test',
      modelId: 'm1',
      messagesCount: 1,
      fetchOnce,
      resolveUserFacingError: () => null,
      retries: 2,
      initialDelayMs: 10,
    });

    const expectation = expect(promise).rejects.toThrow(/rate limit/i);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });
});
