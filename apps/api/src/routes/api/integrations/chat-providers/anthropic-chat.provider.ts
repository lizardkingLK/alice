import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  ChatLlmResponse,
} from './chat-provider.types';

export class AnthropicChatProvider implements ChatModelProvider {
  readonly provider = 'anthropic';

  generateWithTools(_input: ChatModelGenerateInput): Promise<ChatLlmResponse> {
    return Promise.reject(
      new Error('Anthropic chat provider is not yet supported.')
    );
  }
}
