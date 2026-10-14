import { ChatTurnRoles } from '@repo/types';
import type {
  AliceChatTools,
  ChatContentPart,
  ChatContentTurn,
  ChatLlmResponse,
} from '../../chat/chat.route.types';

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
    parameters: Record<string, unknown>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(providerLabel: string): Error {
  return new Error(`${providerLabel} returned an invalid response.`);
}

/** Convert Alice tool declarations into Chat Completions function tools. */
export function aliceChatToolsToOpenAiTools(
  tools: AliceChatTools
): OpenAiTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
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

function takeToolCallId(
  explicitId: string | undefined,
  pendingToolCallIds: string[],
  nextSyntheticId: () => string
): string {
  if (!explicitId) {
    return pendingToolCallIds.shift() ?? nextSyntheticId();
  }

  const pendingIndex = pendingToolCallIds.indexOf(explicitId);
  if (pendingIndex >= 0) {
    pendingToolCallIds.splice(pendingIndex, 1);
  }
  return explicitId;
}

/** Convert Alice conversation turns into Chat Completions messages. */
export function chatContentsToOpenAiMessages(
  systemInstruction: string,
  contents: ChatContentTurn[]
): OpenAiChatMessage[] {
  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemInstruction },
  ];
  const pendingToolCallIds: string[] = [];
  let toolCallCounter = 0;
  const nextSyntheticId = () => `call_${++toolCallCounter}`;

  for (const turn of contents) {
    const functionCalls = turn.parts.filter((part) => part.functionCall);
    const functionResponses = turn.parts.filter(
      (part) => part.functionResponse
    );

    if (turn.role === ChatTurnRoles.Model && functionCalls.length > 0) {
      const toolCalls: OpenAiToolCall[] = functionCalls.map((part) => {
        const functionCall = part.functionCall!;
        const id = functionCall.id || nextSyntheticId();
        pendingToolCallIds.push(id);
        return {
          id,
          type: 'function',
          function: {
            name: functionCall.name,
            arguments: JSON.stringify(functionCall.args ?? {}),
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
        const functionResponse = part.functionResponse!;
        messages.push({
          role: 'tool',
          tool_call_id: takeToolCallId(
            functionResponse.id,
            pendingToolCallIds,
            nextSyntheticId
          ),
          content: JSON.stringify(functionResponse.response.result ?? null),
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

function parseToolCall(
  rawToolCall: unknown,
  providerLabel: string
): ChatContentPart {
  if (!isRecord(rawToolCall) || rawToolCall.type !== 'function') {
    throw invalidResponse(providerLabel);
  }
  const rawFunction = rawToolCall.function;
  if (
    typeof rawToolCall.id !== 'string' ||
    rawToolCall.id.length === 0 ||
    !isRecord(rawFunction) ||
    typeof rawFunction.name !== 'string' ||
    rawFunction.name.length === 0 ||
    typeof rawFunction.arguments !== 'string'
  ) {
    throw invalidResponse(providerLabel);
  }

  let args: unknown;
  try {
    args = JSON.parse(rawFunction.arguments || '{}');
  } catch {
    throw invalidResponse(providerLabel);
  }
  if (!isRecord(args)) {
    throw invalidResponse(providerLabel);
  }

  return {
    functionCall: {
      id: rawToolCall.id,
      name: rawFunction.name,
      args,
    },
  };
}

/** Validate and convert one Chat Completions response into Alice's shape. */
export function openAiChatCompletionToChatLlmResponse(
  payload: unknown,
  providerLabel = 'OpenAI-compatible provider'
): ChatLlmResponse {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw invalidResponse(providerLabel);
  }
  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw invalidResponse(providerLabel);
  }

  const message = firstChoice.message;
  if (
    message.content !== undefined &&
    message.content !== null &&
    typeof message.content !== 'string'
  ) {
    throw invalidResponse(providerLabel);
  }
  if (message.tool_calls !== undefined && !Array.isArray(message.tool_calls)) {
    throw invalidResponse(providerLabel);
  }

  const parts: ChatContentPart[] = [];
  if (typeof message.content === 'string' && message.content.length > 0) {
    parts.push({ text: message.content });
  }
  for (const toolCall of message.tool_calls ?? []) {
    parts.push(parseToolCall(toolCall, providerLabel));
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

/** Parse JSON without exposing provider response content in thrown errors. */
export async function openAiChatCompletionResponseToChatLlmResponse(
  response: Response,
  providerLabel: string
): Promise<ChatLlmResponse> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidResponse(providerLabel);
  }
  return openAiChatCompletionToChatLlmResponse(payload, providerLabel);
}
