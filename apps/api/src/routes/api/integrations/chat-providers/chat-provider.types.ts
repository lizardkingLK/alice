import type {
  AliceChatTools,
  ChatContentTurn,
  ChatLlmResponse,
} from '../../chat/chat.route.types';

export type { AliceChatTools, ChatContentTurn, ChatLlmResponse };

export type ChatModelGenerateInput = {
  apiKey: string;
  apiUrl: string;
  model: string;
  contents: ChatContentTurn[];
  systemInstruction: string;
  tools: AliceChatTools;
};

/** Minimal contract — tools + system instruction stay in ChatService. */
export interface ChatModelProvider {
  readonly provider: string;
  generateWithTools(input: ChatModelGenerateInput): Promise<ChatLlmResponse>;
}

export type ResolvedChatModelConfig = {
  integrationId: string | null;
  provider: string;
  model: string;
  apiKey: string;
  apiUrl: string;
};
