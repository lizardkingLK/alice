import { afterEach, describe, expect, it, vi } from 'vitest';

const { logLlmProviderErrorMock } = vi.hoisted(() => ({
  logLlmProviderErrorMock: vi.fn(),
}));

vi.mock(
  '../../src/routes/api/integrations/chat-providers/llm-error-log',
  () => ({ logLlmProviderError: logLlmProviderErrorMock })
);

import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import { fetchChatProviderWithRetries } from '../../src/routes/api/integrations/chat-providers/fetch-chat-provider-with-retries';

describe('fetchChatProviderWithRetries', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
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

    expect(logLlmProviderErrorMock).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        status: 401,
        responseBodyBytes: 7,
      })
    );
    expect(logLlmProviderErrorMock.mock.calls[0]?.[1]).not.toHaveProperty(
      'errorBody'
    );
  });

  it('does not expose network errors that may contain credentials', async () => {
    const fetchOnce = vi.fn(async () => {
      throw new Error(
        'fetch https://provider.example?key=sk-sensitive failed with Authorization: Bearer sk-sensitive'
      );
    });

    const promise = fetchChatProviderWithRetries({
      provider: 'test',
      providerLabel: 'Test',
      modelId: 'm1',
      messagesCount: 1,
      fetchOnce,
      resolveUserFacingError: () => null,
      retries: 1,
    });

    await expect(promise).rejects.toThrow(
      'Alice AI service is temporarily unavailable due to a network connection issue. Please try again in a few moments.'
    );
    await expect(promise).rejects.not.toThrow(/sk-sensitive|Authorization/);
    expect(logLlmProviderErrorMock).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ responseBodyBytes: 0 })
    );
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
