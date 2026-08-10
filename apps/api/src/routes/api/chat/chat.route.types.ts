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
