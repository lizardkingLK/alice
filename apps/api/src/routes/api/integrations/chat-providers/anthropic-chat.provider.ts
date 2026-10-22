import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from './chat-provider.types';
import {
  aliceChatToolsToAnthropicTools,
  anthropicMessageResponseToChatLlmResponse,
  chatContentsToAnthropicMessages,
} from './anthropic-chat-adapter';
import { resolveApprovedChatProviderApiUrl } from './chat-provider-endpoints';
import { fetchChatProviderWithRetries } from './fetch-chat-provider-with-retries';

export const ANTHROPIC_API_VERSION = '2023-06-01';
export const ANTHROPIC_MAX_TOKENS = 4096;

export function resolveAnthropicUserFacingError(params: {
  status: number;
  errorBody: string;
  modelId: string;
}): string | null {
  if (params.status === 401 || params.status === 403) {
    return 'Anthropic rejected the API key. Update it under Settings → Integrations → Anthropic.';
  }

  if (params.status === 404) {
    return `Anthropic model "${params.modelId}" was not found. Update the model under Settings → Integrations → Anthropic.`;
  }

  if (params.status === 400 || params.status === 413 || params.status === 422) {
    return 'Anthropic rejected the request. Check the configured model and request size, then try again.';
  }

  return null;
}

export class AnthropicChatProvider implements ChatModelProvider {
  readonly provider = 'anthropic';

  async generateWithTools(
    input: ChatModelGenerateInput
  ): Promise<ChatLlmResponse> {
    const apiUrl = resolveApprovedChatProviderApiUrl({
      provider: this.provider,
      model: input.model,
      configuredApiUrl: input.apiUrl,
    });
    const messages = chatContentsToAnthropicMessages(input.contents);
    const tools = aliceChatToolsToAnthropicTools(input.tools);

    const response = await fetchChatProviderWithRetries({
      provider: this.provider,
      providerLabel: 'Anthropic',
      modelId: input.model,
      messagesCount: input.contents.length,
      resolveUserFacingError: resolveAnthropicUserFacingError,
      signal: input.signal,
      fetchOnce: () =>
        fetch(apiUrl, {
          method: 'POST',
          redirect: 'error',
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': input.apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
          },
          body: JSON.stringify({
            model: input.model,
            max_tokens: ANTHROPIC_MAX_TOKENS,
            system: input.systemInstruction,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
          }),
        }),
    });

    return anthropicMessageResponseToChatLlmResponse(
      response,
      input.tools,
      input.signal
    );
  }
}
