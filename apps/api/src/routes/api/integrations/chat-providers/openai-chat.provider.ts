import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from './chat-provider.types';

export class OpenAiChatProvider implements ChatModelProvider {
  readonly provider = 'openai';

  generateWithTools(_input: ChatModelGenerateInput): Promise<ChatLlmResponse> {
    return Promise.reject(
      new Error('OpenAI chat provider is not yet supported.')
    );
  }
}
