import type { ChatTurnRole } from '@repo/types';
import type {
  ChatInputMessage,
  ChatMessageWire,
  ChatToolActionWire,
} from '@repo/types/api/v1';

/** One piece of a ChatService turn (text, tool call, or tool result). */
export interface ChatContentPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: {
      result: unknown;
    };
  };
}

/** One ChatService conversation turn in the tool loop. */
export interface ChatContentTurn {
  role: ChatTurnRole;
  parts: ChatContentPart[];
}

export interface ChatLlmCandidate {
  content?: ChatContentTurn;
}

/**
 * Provider-agnostic LLM response consumed by ChatService.
 * Strategies map their wire responses into this shape.
 */
export interface ChatLlmResponse {
  candidates?: ChatLlmCandidate[];
}

/** JSON-schema style property for an Alice chat tool parameter. */
export type AliceChatToolParameterProperty = {
  type: string;
  description?: string;
  enum?: readonly string[];
  items?: AliceChatToolParameterProperty;
  properties?: Record<string, AliceChatToolParameterProperty>;
  required?: readonly string[];
};

/** One Alice chat tool declaration (provider-agnostic). */
export type AliceChatTool = {
  name: string;
  description: string;
  parameters?: {
    type: 'object';
    properties?: Record<string, AliceChatToolParameterProperty>;
    required?: readonly string[];
  };
};

export type AliceChatTools = readonly AliceChatTool[];

export type InputMessage = ChatInputMessage;
export type ToolAction = ChatToolActionWire;
export type StoredChatMessage = ChatMessageWire;
