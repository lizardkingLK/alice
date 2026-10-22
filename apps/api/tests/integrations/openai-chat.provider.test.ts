import { afterEach, describe, expect, it, vi } from 'vitest';

const { logLlmProviderErrorMock } = vi.hoisted(() => ({
  logLlmProviderErrorMock: vi.fn(),
}));

vi.mock(
  '../../src/routes/api/integrations/chat-providers/llm-error-log',
  () => ({ logLlmProviderError: logLlmProviderErrorMock })
);

import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import { OpenAiChatProvider } from '../../src/routes/api/integrations/chat-providers/openai-chat.provider';
import type { ChatModelGenerateInput } from '../../src/routes/api/integrations/chat-providers/chat-provider.types';

const baseInput: ChatModelGenerateInput = {
  apiKey: 'sk-test-sensitive',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o',
  contents: [
    { role: 'user', parts: [{ text: 'Hello' }] },
    { role: 'model', parts: [{ text: 'How can I help?' }] },
    { role: 'user', parts: [{ text: 'List projects' }] },
  ],
  systemInstruction: 'You are Alice.',
  tools: [
    {
      name: 'list_projects',
      description: 'List accessible projects',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'list_users',
      description: 'List users',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

function completionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenAiChatProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('sends authenticated conversation history and tools, then returns text', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      completionResponse('Done')
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAiChatProvider().generateWithTools(baseInput);

    expect(result.candidates?.[0]?.content?.parts).toEqual([{ text: 'Done' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test-sensitive',
      },
    });
    expect(init).not.toHaveProperty('signal');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Alice.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'How can I help?' },
        { role: 'user', content: 'List projects' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'list_projects',
            description: 'List accessible projects',
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_users',
            description: 'List users',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    });
  });

  it('omits tools when none are registered', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      completionResponse('Tool-free response')
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAiChatProvider().generateWithTools({
      ...baseInput,
      tools: [],
    });

    expect(result.candidates?.[0]?.content?.parts).toEqual([
      { text: 'Tool-free response' },
    ]);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('tools');
  });

  it('forwards a supplied AbortSignal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      completionResponse('Done')
    );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAiChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('preserves cancellation while reading the response body', async () => {
    const controller = new AbortController();
    const response = completionResponse('unused');
    const jsonSpy = vi.spyOn(response, 'json').mockImplementation(
      () =>
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            'abort',
            () =>
              reject(
                new DOMException('The operation was aborted.', 'AbortError')
              ),
            { once: true }
          );
        })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response)
    );

    const promise = new OpenAiChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });
    const expectation = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    await vi.waitFor(() => expect(jsonSpy).toHaveBeenCalledOnce());
    controller.abort();
    await expectation;
  });

  it('preserves multiple tool-call ids and results across model rounds', async () => {
    const fetchMock = vi
      .fn((_url: string, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(completionResponse('unused'))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_projects',
                      type: 'function',
                      function: {
                        name: 'list_projects',
                        arguments: '{}',
                      },
                    },
                    {
                      id: 'call_users',
                      type: 'function',
                      function: { name: 'list_users', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(completionResponse('Both tools completed.'));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiChatProvider();

    const firstResponse = await provider.generateWithTools({
      ...baseInput,
      contents: [{ role: 'user', parts: [{ text: 'List everything' }] }],
    });
    const modelContent = firstResponse.candidates?.[0]?.content;
    expect(modelContent?.parts).toHaveLength(2);

    await provider.generateWithTools({
      ...baseInput,
      contents: [
        { role: 'user', parts: [{ text: 'List everything' }] },
        modelContent!,
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_projects',
                name: 'list_projects',
                response: { result: [{ id: 'p1' }] },
              },
            },
            {
              functionResponse: {
                id: 'call_users',
                name: 'list_users',
                response: { result: [{ id: 'u1' }] },
              },
            },
          ],
        },
      ],
    });

    const secondInit = fetchMock.mock.calls[1]?.[1];
    const secondBody = JSON.parse(String(secondInit?.body));
    expect(secondBody.messages.slice(-3)).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_projects',
            type: 'function',
            function: { name: 'list_projects', arguments: '{}' },
          },
          {
            id: 'call_users',
            type: 'function',
            function: { name: 'list_users', arguments: '{}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_projects',
        content: JSON.stringify([{ id: 'p1' }]),
      },
      {
        role: 'tool',
        tool_call_id: 'call_users',
        content: JSON.stringify([{ id: 'u1' }]),
      },
    ]);
  });

  it('rejects unsafe endpoints before sending the API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new OpenAiChatProvider().generateWithTools({
        ...baseInput,
        apiUrl: 'https://example.invalid/v1/chat/completions?key=secret',
      })
    ).rejects.toThrow(
      'Invalid integration configuration. The chat provider endpoint is not approved.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns safe authentication guidance without exposing provider content', async () => {
    const responseSecret =
      'Authorization: Bearer sk-provider-secret; request rejected';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(responseSecret, { status: 401 }))
    );

    const promise = new OpenAiChatProvider().generateWithTools(baseInput);
    await expect(promise).rejects.toMatchObject({
      name: 'ChatProviderError',
      statusCode: 400,
      message:
        'OpenAI rejected the API key. Update it under Settings → Integrations → OpenAI.',
    } satisfies Partial<ChatProviderError>);
    await expect(promise).rejects.not.toThrow(/sk-provider-secret|Bearer/);
    expect(logLlmProviderErrorMock.mock.calls[0]?.[1]).not.toHaveProperty(
      'errorBody'
    );
    expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
      'sk-provider-secret'
    );
  });

  it.each([
    [429, /rate limit/i],
    [500, /remote server issue/i],
  ])('retries HTTP %s and returns a safe error', async (status, message) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response('sk-provider-secret', {
          status,
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = new OpenAiChatProvider().generateWithTools(baseInput);
    const expectation = expect(promise).rejects.toThrow(message);
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
      'sk-provider-secret'
    );
  });

  it('retries a network failure without exposing it', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Authorization: Bearer sk-network-secret')
      )
      .mockResolvedValueOnce(completionResponse('Recovered'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = new OpenAiChatProvider().generateWithTools(baseInput);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      candidates: [{ content: { parts: [{ text: 'Recovered' }] } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
      'sk-network-secret'
    );
  });

  it('rejects malformed JSON with a safe error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('sk-response-secret {', { status: 200 }))
    );

    await expect(
      new OpenAiChatProvider().generateWithTools(baseInput)
    ).rejects.toThrow('OpenAI returned an invalid response.');
  });
});
