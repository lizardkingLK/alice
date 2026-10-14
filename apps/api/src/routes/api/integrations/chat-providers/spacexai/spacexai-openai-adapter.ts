export {
  aliceChatToolsToOpenAiTools,
  chatContentsToOpenAiMessages,
  openAiChatCompletionToChatLlmResponse,
  openAiChatCompletionResponseToChatLlmResponse,
} from '../openai-compatible-chat-adapter';

export function resolveSpaceXAIUserFacingError(params: {
  status: number;
  errorBody: string;
  modelId: string;
}): string | null {
  if (params.status === 401 || params.status === 403) {
    return 'SpaceXAI rejected the API key. Update it under Settings → Integrations → SpaceXAI.';
  }

  if (params.status === 404) {
    return `SpaceXAI model "${params.modelId}" was not found. Pick a suggested model (e.g. grok-4.3) under Settings → Integrations → SpaceXAI.`;
  }

  if (params.status === 400 || params.status === 422) {
    return 'SpaceXAI rejected the request. Check the configured model and try again.';
  }

  return null;
}
