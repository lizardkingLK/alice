import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  LlmResponse,
} from './chat-provider.types';

export class OpenAiChatProvider implements ChatModelProvider {
  readonly provider = 'openai';

  generateWithTools(_input: ChatModelGenerateInput): Promise<LlmResponse> {
    return Promise.reject(
      new Error('OpenAI chat provider is not yet supported.')
    );
  }
}
