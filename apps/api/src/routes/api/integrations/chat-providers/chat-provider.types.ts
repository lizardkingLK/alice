import type { ContentTurn, GeminiResponse } from '../../chat/chat.route.types';

/** Normalized LLM response — Gemini wire shape for the existing tool loop. */
export type LlmResponse = GeminiResponse;

export type ChatModelGenerateInput = {
  apiKey: string;
  apiUrl: string;
  model: string;
  contents: ContentTurn[];
  systemInstruction: string;
  tools: unknown;
};

/** Minimal contract — tools + system instruction stay in ChatService. */
export interface ChatModelProvider {
  readonly provider: string;
  generateWithTools(input: ChatModelGenerateInput): Promise<LlmResponse>;
}

export type ResolvedChatModelConfig = {
  integrationId: string | null;
  provider: string;
  model: string;
  apiKey: string;
  apiUrl: string;
};
