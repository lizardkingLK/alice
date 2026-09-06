import { ChatTurnRoles } from '@repo/types';
import type {
  AliceChatTools,
  ChatContentPart,
  ChatContentTurn,
  ChatLlmResponse,
} from '../../../chat/chat.route.types';

type OpenAiChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls: OpenAiToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
    };
  }>;
};

/** Convert Alice chat tools into OpenAI / xAI tool definitions. */
export function aliceChatToolsToOpenAiTools(
  tools: AliceChatTools
): OpenAiTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      // xAI requires `parameters` on every tool (422 if omitted).
      parameters: tool.parameters
        ? { ...tool.parameters }
        : { type: 'object', properties: {} },
    },
  }));
}

function textFromParts(parts: ChatContentPart[] | undefined): string {
  return (parts ?? [])
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('\n');
}

/**
 * Convert ChatService turns into OpenAI chat messages.
 * Tracks generated tool_call ids so later functionResponse parts map to
 * OpenAI `tool` messages.
 */
export function chatContentsToOpenAiMessages(
  systemInstruction: string,
  contents: ChatContentTurn[]
): OpenAiChatMessage[] {
  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemInstruction },
  ];
  const pendingToolCallIds: string[] = [];
  let toolCallCounter = 0;

  for (const turn of contents) {
    const functionCalls = (turn.parts ?? []).filter(
      (part) => part.functionCall
    );
    const functionResponses = (turn.parts ?? []).filter(
      (part) => part.functionResponse
    );

    if (turn.role === ChatTurnRoles.Model && functionCalls.length > 0) {
      const toolCalls: OpenAiToolCall[] = functionCalls.map((part) => {
        toolCallCounter += 1;
        const id = `call_${toolCallCounter}`;
        pendingToolCallIds.push(id);
        return {
          id,
          type: 'function',
          function: {
            name: part.functionCall!.name,
            arguments: JSON.stringify(part.functionCall!.args ?? {}),
          },
        };
      });

      messages.push({
        role: 'assistant',
        content: textFromParts(turn.parts) || null,
        tool_calls: toolCalls,
      });
      continue;
    }

    if (functionResponses.length > 0) {
      for (const part of functionResponses) {
        const toolCallId =
          pendingToolCallIds.shift() ?? `call_${++toolCallCounter}`;
        messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify(
            part.functionResponse?.response?.result ?? null
          ),
        });
      }
      continue;
    }

    const text = textFromParts(turn.parts);
    if (!text) {
      continue;
    }

    messages.push({
      role: turn.role === ChatTurnRoles.Model ? 'assistant' : 'user',
      content: text,
    });
  }

  return messages;
}

/** Map OpenAI chat.completion JSON into ChatService LLM response. */
export function openAiChatCompletionToChatLlmResponse(
  payload: unknown
): ChatLlmResponse {
  const response = payload as OpenAiChatCompletionResponse;
  const message = response.choices?.[0]?.message;
  if (!message) {
    return { candidates: [] };
  }

  const parts: ChatContentPart[] = [];

  if (typeof message.content === 'string' && message.content.length > 0) {
    parts.push({ text: message.content });
  }

  for (const toolCall of message.tool_calls ?? []) {
    let args: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(toolCall.function.arguments || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      args = {};
    }

    parts.push({
      functionCall: {
        name: toolCall.function.name,
        args,
      },
    });
  }

  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return {
    candidates: [
      {
        content: {
          role: ChatTurnRoles.Model,
          parts,
        },
      },
    ],
  };
}

export function parseSpaceXAIApiErrorMessage(
  errorBody: string
): string | undefined {
  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { message?: string };
      message?: string;
    };
    if (typeof parsed.error?.message === 'string') {
      return parsed.error.message;
    }
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function resolveSpaceXAIUserFacingError(params: {
  status: number;
  errorBody: string;
  modelId: string;
}): string | null {
  const trimmedBody = params.errorBody.trim();
  const apiMessage =
    parseSpaceXAIApiErrorMessage(params.errorBody) ??
    (trimmedBody.length > 0 ? trimmedBody : undefined);

  if (params.status === 401 || params.status === 403) {
    return 'SpaceXAI rejected the API key. Update it under Settings → Integrations → SpaceXAI.';
  }

  if (params.status === 404) {
    return `SpaceXAI model "${params.modelId}" was not found. Pick a suggested model (e.g. grok-4.3) under Settings → Integrations → SpaceXAI.`;
  }

  if (params.status === 422 && apiMessage) {
    return `SpaceXAI rejected the request: ${apiMessage}`;
  }

  if (apiMessage) {
    return `SpaceXAI error: ${apiMessage}`;
  }

  return null;
}
