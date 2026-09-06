import { AnthropicChatProvider } from './anthropic-chat.provider';
import type { ChatModelProvider } from './chat-provider.types';
import { GeminiChatProvider } from './gemini/gemini-chat.provider';
import { OpenAiChatProvider } from './openai-chat.provider';
import { SpaceXAIChatProvider } from './spacexai/spacexai-chat.provider';

const geminiChatProvider = new GeminiChatProvider();
const spaceXAIChatProvider = new SpaceXAIChatProvider();
const openAiChatProvider = new OpenAiChatProvider();
const anthropicChatProvider = new AnthropicChatProvider();

const chatProviders: Record<string, ChatModelProvider> = {
  [geminiChatProvider.provider]: geminiChatProvider,
  [spaceXAIChatProvider.provider]: spaceXAIChatProvider,
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
