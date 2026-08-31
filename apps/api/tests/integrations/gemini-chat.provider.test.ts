import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProviderError } from '../../src/routes/api/integrations/chat-providers/chat-provider.error';
import { GeminiChatProvider } from '../../src/routes/api/integrations/chat-providers/gemini-chat.provider';

describe('GeminiChatProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
  });
});
