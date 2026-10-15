import { ChatTurnRoles } from '@repo/types';
import type {
  AliceChatTool,
  AliceChatToolParameterProperty,
  AliceChatTools,
  ChatContentPart,
  ChatContentTurn,
  ChatLlmResponse,
} from '../../chat/chat.route.types';
import { ChatProviderError } from './chat-provider.error';

type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
};

type AnthropicContentBlock =
  AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
};

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): Error {
  return new Error('Anthropic returned an invalid response.');
}

function invalidConversation(): Error {
  return new Error('Anthropic conversation contains invalid tool context.');
}

function objectMatchesToolSchema(
  value: unknown,
  schema: AliceChatToolParameterProperty
): boolean {
  if (!isRecord(value)) return false;

  for (const requiredName of schema.required ?? []) {
    if (!Object.hasOwn(value, requiredName)) return false;
  }

  for (const [propertyName, propertySchema] of Object.entries(
    schema.properties ?? {}
  )) {
    if (
      Object.hasOwn(value, propertyName) &&
      !valueMatchesToolSchema(value[propertyName], propertySchema)
    ) {
      return false;
    }
  }

  return true;
}

function valueMatchesToolSchema(
  value: unknown,
  schema: AliceChatToolParameterProperty
): boolean {
  if (schema.enum && !schema.enum.includes(value as string)) {
    return false;
  }

  switch (schema.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return (
        Array.isArray(value) &&
        (!schema.items ||
          value.every((item) => valueMatchesToolSchema(item, schema.items!)))
      );
    case 'object':
      return objectMatchesToolSchema(value, schema);
    default:
      return false;
  }
}

function argumentsMatchToolSchema(
  args: Record<string, unknown>,
  tool: AliceChatTool
): boolean {
  if (!tool.parameters) {
    return Object.keys(args).length === 0;
  }

  return valueMatchesToolSchema(args, tool.parameters);
}

/** Convert Alice tool declarations into Anthropic client-tool definitions. */
export function aliceChatToolsToAnthropicTools(
  tools: AliceChatTools
): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
      ? { ...tool.parameters }
      : { type: 'object', properties: {} },
  }));
}

function orderUserBlocks(
  content: AnthropicContentBlock[]
): AnthropicContentBlock[] {
  return [
    ...content.filter((block) => block.type === 'tool_result'),
    ...content.filter((block) => block.type !== 'tool_result'),
  ];
}

function appendMessage(
  messages: AnthropicMessage[],
  role: AnthropicMessage['role'],
  content: AnthropicContentBlock[]
): void {
  if (content.length === 0) return;

  const lastMessage = messages.at(-1);
  if (lastMessage?.role === role) {
    lastMessage.content.push(...content);
    if (role === 'user') {
      lastMessage.content = orderUserBlocks(lastMessage.content);
    }
    return;
  }

  messages.push({
    role,
    content: role === 'user' ? orderUserBlocks(content) : content,
  });
}

type PendingToolUse = {
  id: string;
  name: string;
};

type MessageConversionState = {
  pendingToolUses: PendingToolUse[];
  seenToolUseIds: Set<string>;
  syntheticIdCounter: number;
};

function takePendingToolUse(
  functionResponse: NonNullable<ChatContentPart['functionResponse']>,
  pendingToolUses: PendingToolUse[]
): PendingToolUse {
  const pendingIndex = functionResponse.id
    ? pendingToolUses.findIndex(
        (toolUse) =>
          toolUse.id === functionResponse.id &&
          toolUse.name === functionResponse.name
      )
    : pendingToolUses.findIndex(
        (toolUse) => toolUse.name === functionResponse.name
      );

  if (pendingIndex < 0) {
    throw invalidConversation();
  }

  return pendingToolUses.splice(pendingIndex, 1)[0]!;
}

function functionCallToToolUse(
  functionCall: NonNullable<ChatContentPart['functionCall']>,
  state: MessageConversionState
): AnthropicToolUseBlock {
  const id = functionCall.id || `toolu_alice_${++state.syntheticIdCounter}`;
  if (state.seenToolUseIds.has(id)) throw invalidConversation();

  state.seenToolUseIds.add(id);
  state.pendingToolUses.push({ id, name: functionCall.name });
  return {
    type: 'tool_use',
    id,
    name: functionCall.name,
    input: functionCall.args ?? {},
  };
}

function functionResponseToToolResult(
  functionResponse: NonNullable<ChatContentPart['functionResponse']>,
  state: MessageConversionState
): AnthropicToolResultBlock {
  const toolUse = takePendingToolUse(functionResponse, state.pendingToolUses);
  return {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    content: JSON.stringify(functionResponse.response.result ?? null),
  };
}

function chatContentPartToAnthropicBlocks(
  part: ChatContentPart,
  role: AnthropicMessage['role'],
  state: MessageConversionState
): AnthropicContentBlock[] {
  const blocks: AnthropicContentBlock[] = [];
  if (typeof part.text === 'string' && part.text.length > 0) {
    blocks.push({ type: 'text', text: part.text });
  }

  if (part.functionCall) {
    if (role !== 'assistant') throw invalidConversation();
    blocks.push(functionCallToToolUse(part.functionCall, state));
  }

  if (part.functionResponse) {
    if (role !== 'user') throw invalidConversation();
    blocks.push(functionResponseToToolResult(part.functionResponse, state));
  }

  return blocks;
}

/** Convert Alice turns into alternating Anthropic user/assistant messages. */
export function chatContentsToAnthropicMessages(
  contents: ChatContentTurn[]
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];
  const state: MessageConversionState = {
    pendingToolUses: [],
    seenToolUseIds: new Set<string>(),
    syntheticIdCounter: 0,
  };

  for (const turn of contents) {
    const role =
      turn.role === ChatTurnRoles.Model ? 'assistant' : ('user' as const);
    const blocks = turn.parts.flatMap((part) =>
      chatContentPartToAnthropicBlocks(part, role, state)
    );

    appendMessage(messages, role, blocks);
  }

  return messages;
}

function parseToolUse(
  block: Record<string, unknown>,
  tools: AliceChatTools,
  seenToolUseIds: Set<string>
): ChatContentPart {
  if (
    typeof block.id !== 'string' ||
    block.id.length === 0 ||
    seenToolUseIds.has(block.id) ||
    typeof block.name !== 'string' ||
    block.name.length === 0 ||
    !isRecord(block.input)
  ) {
    throw invalidResponse();
  }

  const selectedTool = tools.find((tool) => tool.name === block.name);
  if (!selectedTool || !argumentsMatchToolSchema(block.input, selectedTool)) {
    throw invalidResponse();
  }

  seenToolUseIds.add(block.id);
  return {
    functionCall: {
      id: block.id,
      name: block.name,
      args: block.input,
    },
  };
}

function assertNormalStopReason(
  stopReason: unknown,
  textBlockCount: number,
  toolUseCount: number
): void {
  if (stopReason === 'tool_use') {
    if (toolUseCount === 0) throw invalidResponse();
    return;
  }

  if (
    stopReason === 'max_tokens' ||
    stopReason === 'model_context_window_exceeded'
  ) {
    throw new ChatProviderError(
      'Anthropic stopped because the response reached its token limit. Try a shorter request.'
    );
  }

  if (stopReason === 'refusal') {
    throw new ChatProviderError('Anthropic declined this request.');
  }

  if (
    (stopReason !== 'end_turn' && stopReason !== 'stop_sequence') ||
    textBlockCount === 0 ||
    toolUseCount > 0
  ) {
    throw invalidResponse();
  }
}

/** Validate and convert one Anthropic Messages response into Alice's shape. */
export function anthropicMessageToChatLlmResponse(
  payload: unknown,
  tools: AliceChatTools
): ChatLlmResponse {
  if (
    !isRecord(payload) ||
    payload.type !== 'message' ||
    payload.role !== 'assistant' ||
    typeof payload.id !== 'string' ||
    payload.id.length === 0 ||
    typeof payload.model !== 'string' ||
    payload.model.length === 0 ||
    !Array.isArray(payload.content)
  ) {
    throw invalidResponse();
  }

  const parts: ChatContentPart[] = [];
  const seenToolUseIds = new Set<string>();
  let textBlockCount = 0;
  let toolUseCount = 0;

  for (const rawBlock of payload.content) {
    if (!isRecord(rawBlock)) throw invalidResponse();

    if (rawBlock.type === 'text') {
      if (typeof rawBlock.text !== 'string') throw invalidResponse();
      if (rawBlock.text.length > 0) {
        textBlockCount += 1;
        parts.push({ text: rawBlock.text });
      }
      continue;
    }

    if (rawBlock.type === 'tool_use') {
      toolUseCount += 1;
      parts.push(parseToolUse(rawBlock, tools, seenToolUseIds));
      continue;
    }

    throw invalidResponse();
  }

  assertNormalStopReason(payload.stop_reason, textBlockCount, toolUseCount);

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
export async function anthropicMessageResponseToChatLlmResponse(
  response: Response,
  tools: AliceChatTools
): Promise<ChatLlmResponse> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidResponse();
  }

  return anthropicMessageToChatLlmResponse(payload, tools);
}
