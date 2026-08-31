import type { GeminiRole } from '@repo/types';
import type {
  ChatInputMessage,
  ChatMessageWire,
  ChatToolActionWire,
} from '@repo/types/api/v1';

export interface ContentPart {
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

export interface ContentTurn {
  role: GeminiRole;
  parts: ContentPart[];
}

export interface GeminiCandidate {
  content?: ContentTurn;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export type InputMessage = ChatInputMessage;
export type ToolAction = ChatToolActionWire;
export type StoredChatMessage = ChatMessageWire;
