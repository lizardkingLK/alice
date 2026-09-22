import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from '../chat-provider.types';
import { fetchChatProviderWithRetries } from '../fetch-chat-provider-with-retries';
import {
  aliceChatToolsToOpenAiTools,
  chatContentsToOpenAiMessages,
  openAiChatCompletionToChatLlmResponse,
  resolveSpaceXAIUserFacingError,
} from './spacexai-openai-adapter';

/**
 * xAI (SpaceXAI) chat provider — OpenAI-compatible `/v1/chat/completions`.
 * Adapts ChatService shapes ↔ OpenAI wire formats inside this strategy.
 */
export class SpaceXAIChatProvider implements ChatModelProvider {
  readonly provider = 'spacexai';

  async generateWithTools(
    input: ChatModelGenerateInput
  ): Promise<ChatLlmResponse> {
    const messages = chatContentsToOpenAiMessages(
      input.systemInstruction,
      input.contents
    );
    const tools = aliceChatToolsToOpenAiTools(input.tools);

    const response = await fetchChatProviderWithRetries({
      provider: this.provider,
      providerLabel: 'SpaceXAI',
      modelId: input.model,
      messagesCount: input.contents.length,
      resolveUserFacingError: resolveSpaceXAIUserFacingError,
      fetchOnce: () =>
        fetch(input.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify({
            model: input.model,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
          }),
        }),
    });

    const payload: unknown = await response.json();
    return openAiChatCompletionToChatLlmResponse(payload);
  }
}
