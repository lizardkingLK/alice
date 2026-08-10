import { ChatRole } from '@repo/types';

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
  role: 'user' | 'model';
  parts: ContentPart[];
}

export interface GeminiCandidate {
  content?: ContentTurn;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export interface InputMessage {
  role: string;
  content?: string;
  text?: string;
  parts?: ContentPart[];
  id?: string;
  actions?: ToolAction[];
}

export interface ToolAction {
  type: 'create_project' | 'create_sprint' | 'create_work_item';
  entity: {
    id: string;
    name?: string;
    key?: string;
    title?: string;
    status?: string;
  };
}
export interface StoredChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  actions?: ToolAction[];
}
