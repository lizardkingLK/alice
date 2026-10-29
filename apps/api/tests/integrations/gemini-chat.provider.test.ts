import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import { GEMINI_API_KEY_REJECTED_MESSAGE } from '../../src/routes/api/integrations/chat-providers/gemini/alice-chatbot-errors';
import { GeminiChatProvider } from '../../src/routes/api/integrations/chat-providers/gemini/gemini-chat.provider';
import type { ChatModelGenerateInput } from '../../src/routes/api/integrations/chat-providers/chat-provider.types';

const baseInput: ChatModelGenerateInput = {
  apiKey: 'gemini-test-key',
  apiUrl:
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
  model: 'gemini-3.6-flash',
  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
  systemInstruction: 'You are Alice.',
  tools: [],
};

function geminiResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('GeminiChatProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends Gemini history, system instructions, and tools and returns text', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: 'Gemini response' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new GeminiChatProvider().generateWithTools({
      apiKey: 'gemini-test-key',
      apiUrl:
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      model: 'gemini-3.6-flash',
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi' }] },
      ],
      systemInstruction: 'You are Alice.',
      tools: [
        {
          name: 'list_projects',
          description: 'List projects',
          parameters: { type: 'object', properties: {} },
        },
      ],
    });

    expect(result.candidates?.[0]?.content?.parts).toEqual([
      { text: 'Gemini response' },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=gemini-test-key'
    );
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi' }] },
      ],
      systemInstruction: { parts: [{ text: 'You are Alice.' }] },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'list_projects',
              description: 'List projects',
              parameters: { type: 'OBJECT', properties: {} },
            },
          ],
        },
      ],
    });
  });

  it('does not fetch when the supplied signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new GeminiChatProvider().generateWithTools({
        ...baseInput,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards cancellation to the active fetch without retrying', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = new GeminiChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    controller.abort();
    await expectation;

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('cancels retry backoff without starting another fetch', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(geminiResponse('unused'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = new GeminiChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort();
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preserves cancellation while reading the response body', async () => {
    const controller = new AbortController();
    const response = geminiResponse('unused');
    let resolveJson!: (value: unknown) => void;
    const jsonPromise = new Promise<unknown>((resolve) => {
      resolveJson = resolve;
    });
    const jsonSpy = vi
      .spyOn(response, 'json')
      .mockImplementation(() => jsonPromise);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response)
    );

    const promise = new GeminiChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    await vi.waitFor(() => expect(jsonSpy).toHaveBeenCalledOnce());
    controller.abort();
    resolveJson({ candidates: [] });
    await expectation;
  });

  it('throws ChatProviderError when Google reports a retired model', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () =>
          JSON.stringify({
            error: {
              code: 404,
              message:
                'This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements.',
              status: 'NOT_FOUND',
            },
          }),
      }))
    );

    const provider = new GeminiChatProvider();

    await expect(
      provider.generateWithTools({
        apiKey: 'test-key',
        apiUrl:
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        systemInstruction: 'You are Alice.',
        tools: [],
      })
    ).rejects.toMatchObject({
      name: 'ChatProviderError',
      statusCode: 400,
      message: expect.stringContaining('gemini-3.5-flash-lite'),
    } satisfies Partial<ChatProviderError>);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('throws ChatProviderError when Google rejects an expired API key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          JSON.stringify({
            error: {
              code: 403,
              message: 'API key expired. Please renew the API key.',
              status: 'PERMISSION_DENIED',
            },
          }),
      }))
    );

    const provider = new GeminiChatProvider();

    await expect(
      provider.generateWithTools({
        apiKey: 'expired-key',
        apiUrl:
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        systemInstruction: 'You are Alice.',
        tools: [],
      })
    ).rejects.toMatchObject({
      name: 'ChatProviderError',
      statusCode: 400,
      message: GEMINI_API_KEY_REJECTED_MESSAGE,
    } satisfies Partial<ChatProviderError>);
  });
});
