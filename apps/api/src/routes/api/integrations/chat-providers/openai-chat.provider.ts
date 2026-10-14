import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from './chat-provider.types';
import { resolveApprovedChatProviderApiUrl } from './chat-provider-endpoints';
import { fetchChatProviderWithRetries } from './fetch-chat-provider-with-retries';
import {
  aliceChatToolsToOpenAiTools,
  chatContentsToOpenAiMessages,
  openAiChatCompletionResponseToChatLlmResponse,
} from './openai-compatible-chat-adapter';

export function resolveOpenAIUserFacingError(params: {
  status: number;
  errorBody: string;
  modelId: string;
}): string | null {
  if (params.status === 401 || params.status === 403) {
    return 'OpenAI rejected the API key. Update it under Settings → Integrations → OpenAI.';
  }

  if (params.status === 404) {
    return `OpenAI model "${params.modelId}" was not found. Update the model under Settings → Integrations → OpenAI.`;
  }

  if (params.status === 400 || params.status === 422) {
    return 'OpenAI rejected the request. Check the configured model and try again.';
  }

  return null;
}

export class OpenAiChatProvider implements ChatModelProvider {
  readonly provider = 'openai';

  async generateWithTools(
    input: ChatModelGenerateInput
  ): Promise<ChatLlmResponse> {
    const apiUrl = resolveApprovedChatProviderApiUrl({
      provider: this.provider,
      model: input.model,
      configuredApiUrl: input.apiUrl,
    });
    const messages = chatContentsToOpenAiMessages(
      input.systemInstruction,
      input.contents
    );
    const tools = aliceChatToolsToOpenAiTools(input.tools);

    const response = await fetchChatProviderWithRetries({
      provider: this.provider,
      providerLabel: 'OpenAI',
      modelId: input.model,
      messagesCount: input.contents.length,
      resolveUserFacingError: resolveOpenAIUserFacingError,
      fetchOnce: () =>
        fetch(apiUrl, {
          method: 'POST',
          redirect: 'error',
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

    return openAiChatCompletionResponseToChatLlmResponse(response, 'OpenAI');
  }
}
