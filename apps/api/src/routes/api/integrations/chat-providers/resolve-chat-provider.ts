import { AnthropicChatProvider } from './anthropic-chat.provider';
import type { ChatModelProvider } from './chat-provider.types';
import { GeminiChatProvider } from './gemini-chat.provider';
import { OpenAiChatProvider } from './openai-chat.provider';

const geminiChatProvider = new GeminiChatProvider();
const openAiChatProvider = new OpenAiChatProvider();
const anthropicChatProvider = new AnthropicChatProvider();

const chatProviders: Record<string, ChatModelProvider> = {
  [geminiChatProvider.provider]: geminiChatProvider,
  [openAiChatProvider.provider]: openAiChatProvider,
  [anthropicChatProvider.provider]: anthropicChatProvider,
};

export function resolveChatProvider(providerSlug: string): ChatModelProvider {
  const provider = chatProviders[providerSlug];
  if (!provider) {
    throw new Error(`Unsupported chat provider: ${providerSlug}`);
  }
  return provider;
}
