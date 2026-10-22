import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliceChatTools } from '../../src/routes/api/chat/chat.route.data';

const { logLlmProviderErrorMock } = vi.hoisted(() => ({
  logLlmProviderErrorMock: vi.fn(),
}));

vi.mock(
  '../../src/routes/api/integrations/chat-providers/llm-error-log',
  () => ({ logLlmProviderError: logLlmProviderErrorMock })
);

import type { ChatModelGenerateInput } from '../../src/routes/api/integrations/chat-providers/chat-provider.types';
import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_MAX_TOKENS,
  AnthropicChatProvider,
} from '../../src/routes/api/integrations/chat-providers/anthropic-chat.provider';

const baseInput: ChatModelGenerateInput = {
  apiKey: 'sk-ant-test-sensitive',
  apiUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  contents: [
    { role: 'user', parts: [{ text: 'Hello' }] },
    { role: 'model', parts: [{ text: 'How can I help?' }] },
    { role: 'user', parts: [{ text: 'List projects' }] },
  ],
  systemInstruction: 'You are Alice.',
  tools: aliceChatTools.filter(
    (tool) => tool.name === 'list_projects' || tool.name === 'list_users'
  ),
};

function anthropicResponse(
  content: unknown[],
  stopReason: string = 'end_turn'
): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: baseInput.model,
      content,
      stop_reason: stopReason,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('AnthropicChatProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('sends the Messages API request and returns text', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      anthropicResponse([{ type: 'text', text: 'Done' }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new AnthropicChatProvider().generateWithTools(
      baseInput
    );

    expect(result.candidates?.[0]?.content?.parts).toEqual([{ text: 'Done' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'sk-ant-test-sensitive',
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
    });
    expect(init).not.toHaveProperty('signal');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'claude-sonnet-4-20250514',
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: 'You are Alice.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'How can I help?' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'List projects' }],
        },
      ],
      tools: [
        {
          name: 'list_projects',
          description:
            'Retrieve all accessible projects available to the current user. Use this when the user asks to show or list projects, or to check if a project exists.',
          input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: 'list_users',
          description:
            'Retrieve list of all users in the system to find assignees.',
          input_schema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      ],
    });
    expect(String(init?.body)).not.toContain(baseInput.apiKey);
  });

  it('preserves multiple tool ids and matching results in the next round', async () => {
    const fetchMock = vi
      .fn((_url: string, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(anthropicResponse([{ type: 'text', text: 'unused' }]))
      )
      .mockResolvedValueOnce(
        anthropicResponse(
          [
            {
              type: 'tool_use',
              id: 'toolu_projects',
              name: 'list_projects',
              input: {},
            },
            {
              type: 'tool_use',
              id: 'toolu_users',
              name: 'list_users',
              input: {},
            },
          ],
          'tool_use'
        )
      )
      .mockResolvedValueOnce(
        anthropicResponse([{ type: 'text', text: 'Both completed.' }])
      );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new AnthropicChatProvider();

    const firstResponse = await provider.generateWithTools({
      ...baseInput,
      contents: [{ role: 'user', parts: [{ text: 'List everything' }] }],
    });
    const modelContent = firstResponse.candidates?.[0]?.content;

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
                id: 'toolu_projects',
                name: 'list_projects',
                response: { result: [{ id: 'p1' }] },
              },
            },
            {
              functionResponse: {
                id: 'toolu_users',
                name: 'list_users',
                response: { result: [{ id: 'u1' }] },
              },
            },
          ],
        },
      ],
    });

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.messages.slice(-2)).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_projects',
            name: 'list_projects',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'toolu_users',
            name: 'list_users',
            input: {},
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_projects',
            content: JSON.stringify([{ id: 'p1' }]),
          },
          {
            type: 'tool_result',
            tool_use_id: 'toolu_users',
            content: JSON.stringify([{ id: 'u1' }]),
          },
        ],
      },
    ]);
  });

  it('omits tools when none are registered', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      anthropicResponse([{ type: 'text', text: 'Done' }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new AnthropicChatProvider().generateWithTools({
      ...baseInput,
      tools: [],
    });

    expect(result.candidates?.[0]?.content?.parts).toEqual([{ text: 'Done' }]);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).not.toHaveProperty('tools');
  });

  it('forwards a supplied AbortSignal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      anthropicResponse([{ type: 'text', text: 'Done' }])
    );
    vi.stubGlobal('fetch', fetchMock);

    await new AnthropicChatProvider().generateWithTools({
      ...baseInput,
      signal: controller.signal,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('preserves cancellation while reading the response body', async () => {
    const controller = new AbortController();
    const response = anthropicResponse([{ type: 'text', text: 'unused' }]);
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

    const promise = new AnthropicChatProvider().generateWithTools({
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

  it('rejects unsafe endpoints before sending the API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new AnthropicChatProvider().generateWithTools({
        ...baseInput,
        apiUrl: 'https://example.invalid/v1/messages?key=secret',
      })
    ).rejects.toThrow(
      'Invalid integration configuration. The chat provider endpoint is not approved.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns safe authentication guidance without exposing provider content', async () => {
    const responseSecret = 'x-api-key: sk-ant-provider-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(responseSecret, { status: 401 }))
    );

    const promise = new AnthropicChatProvider().generateWithTools(baseInput);
    await expect(promise).rejects.toMatchObject({
      name: 'ChatProviderError',
      statusCode: 400,
      message:
        'Anthropic rejected the API key. Update it under Settings → Integrations → Anthropic.',
    } satisfies Partial<ChatProviderError>);
    await expect(promise).rejects.not.toThrow(
      /sk-ant-provider-secret|x-api-key/
    );
    expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
      'sk-ant-provider-secret'
    );
  });

  it('returns safe invalid-model guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret model error', { status: 404 }))
    );

    await expect(
      new AnthropicChatProvider().generateWithTools(baseInput)
    ).rejects.toThrow(/model.*was not found/i);
  });

  it.each([429, 500, 529])(
    'retries HTTP %s and returns a safe error',
    async (status) => {
      vi.useFakeTimers();
      const fetchMock = vi.fn(async () =>
        Promise.resolve(new Response('sk-ant-provider-secret', { status }))
      );
      vi.stubGlobal('fetch', fetchMock);

      const promise = new AnthropicChatProvider().generateWithTools(baseInput);
      const expectation = expect(promise).rejects.toThrow(
        status === 429 ? /rate limit/i : /remote server issue/i
      );
      await vi.runAllTimersAsync();
      await expectation;

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
        'sk-ant-provider-secret'
      );
    }
  );

  it('rejects redirect/network failures without exposing credentials', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('redirect included sk-ant-network-secret'));
    vi.stubGlobal('fetch', fetchMock);

    const promise = new AnthropicChatProvider().generateWithTools(baseInput);
    const expectation = expect(promise).rejects.toThrow(/network connection/i);
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ redirect: 'error' });
    }
    expect(JSON.stringify(logLlmProviderErrorMock.mock.calls)).not.toContain(
      'sk-ant-network-secret'
    );
  });

  it('rejects malformed JSON without exposing its content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('sk-ant-response-secret {', { status: 200 })
      )
    );

    await expect(
      new AnthropicChatProvider().generateWithTools(baseInput)
    ).rejects.toMatchObject({
      message: 'Anthropic returned an invalid response.',
      category: 'invalid_json',
    });
  });
});
