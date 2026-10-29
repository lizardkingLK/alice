import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpaceXAIChatProvider } from '../../src/routes/api/integrations/chat-providers/spacexai/spacexai-chat.provider';
import type { ChatModelGenerateInput } from '../../src/routes/api/integrations/chat-providers/chat-provider.types';

const baseInput: ChatModelGenerateInput = {
  apiKey: 'xai-test-key',
  apiUrl: 'https://api.x.ai/v1/chat/completions',
  model: 'grok-4.3',
  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
  systemInstruction: 'You are Alice.',
  tools: [],
};

function completionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SpaceXAIChatProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends authenticated OpenAI-compatible history and tools and returns text', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Grok response' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new SpaceXAIChatProvider().generateWithTools({
      apiKey: 'xai-test-key',
      apiUrl: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-4.3',
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
      { text: 'Grok response' },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer xai-test-key',
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'grok-4.3',
      messages: [
        { role: 'system', content: 'You are Alice.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'list_projects',
            description: 'List projects',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });
    expect(String(init?.body)).not.toContain('xai-test-key');
  });

  it('does not fetch when the supplied signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new SpaceXAIChatProvider().generateWithTools({
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

    const promise = new SpaceXAIChatProvider().generateWithTools({
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
      .mockResolvedValueOnce(completionResponse('unused'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = new SpaceXAIChatProvider().generateWithTools({
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
    const response = completionResponse('unused');
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

    const promise = new SpaceXAIChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    await vi.waitFor(() => expect(jsonSpy).toHaveBeenCalledOnce());
    controller.abort();
    resolveJson({ choices: [{ message: { content: 'unused' } }] });
    await expectation;
  });

  it('does not follow redirects that could forward the authorization header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          choices: [{ message: { content: 'Hello' } }],
        }),
      }))
    );

    const provider = new SpaceXAIChatProvider();
    await provider.generateWithTools({
      apiKey: 'test-key',
      apiUrl: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-4.3',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      systemInstruction: 'You are Alice.',
      tools: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({ redirect: 'error' })
    );
  });
});
