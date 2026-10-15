import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpaceXAIChatProvider } from '../../src/routes/api/integrations/chat-providers/spacexai/spacexai-chat.provider';

describe('SpaceXAIChatProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
