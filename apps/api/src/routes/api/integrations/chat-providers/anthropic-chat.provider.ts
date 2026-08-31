import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  LlmResponse,
} from './chat-provider.types';

export class AnthropicChatProvider implements ChatModelProvider {
  readonly provider = 'anthropic';

  generateWithTools(_input: ChatModelGenerateInput): Promise<LlmResponse> {
    return Promise.reject(
      new Error('Anthropic chat provider is not yet supported.')
    );
  }
}
