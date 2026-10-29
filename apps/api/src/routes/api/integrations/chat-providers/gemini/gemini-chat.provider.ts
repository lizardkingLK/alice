import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from '../chat-provider.types';
import { fetchChatProviderWithRetries } from '../fetch-chat-provider-with-retries';
import { resolveGeminiUserFacingError } from './alice-chatbot-errors';
import { aliceChatToolsToGeminiTools } from './gemini-tools-adapter';

function buildGeminiUrl(baseUrl: string, apiKey: string): string {
  return baseUrl.includes('key=')
    ? `${baseUrl}${apiKey}`
    : `${baseUrl}?key=${apiKey}`;
}

export class GeminiChatProvider implements ChatModelProvider {
  readonly provider = 'gemini';

  async generateWithTools(
    input: ChatModelGenerateInput
  ): Promise<ChatLlmResponse> {
    const url = buildGeminiUrl(input.apiUrl, input.apiKey);
    const tools = aliceChatToolsToGeminiTools(input.tools);

    const response = await fetchChatProviderWithRetries({
      provider: this.provider,
      providerLabel: 'Gemini',
      modelId: input.model,
      messagesCount: input.contents.length,
      resolveUserFacingError: resolveGeminiUserFacingError,
      signal: input.signal,
      fetchOnce: () =>
        fetch(url, {
          method: 'POST',
          redirect: 'error',
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: input.contents,
            systemInstruction: {
              parts: [{ text: input.systemInstruction }],
            },
            tools,
          }),
        }),
    });

    // Gemini wire response matches ChatLlmResponse structurally.
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error: unknown) {
      input.signal?.throwIfAborted();
      throw error;
    }
    input.signal?.throwIfAborted();
    return payload as ChatLlmResponse;
  }
}
