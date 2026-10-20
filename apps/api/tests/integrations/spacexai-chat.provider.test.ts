import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpaceXAIChatProvider } from '../../src/routes/api/integrations/chat-providers/spacexai/spacexai-chat.provider';

describe('SpaceXAIChatProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
