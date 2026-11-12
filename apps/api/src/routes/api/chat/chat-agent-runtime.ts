import { decryptSecret } from '../../../lib/secrets/token-crypto';
import type { ChatAgentDetailRow } from '@repo/types';
import type { AliceChatTools } from './chat.route.types';
import {
  aliceChatTools,
  chartDescriptionSystemPrompt,
  dynamicFieldsSystemPrompt,
  systemInstruction,
} from './chat.route.data';
import type { ChatAgentsRepository } from '../chat-agents/chat-agents.repository';

export const CHART_DESCRIPTION_TOOL_KEY = 'generate_chart_description';
export const DYNAMIC_FIELDS_TOOL_KEY = 'generate_project_fields_schema';

export type ResolvedChatAgentRuntime = {
  readonly agentId: string | null;
  readonly instructions: string;
  readonly tools: AliceChatTools;
  readonly enabledToolNames: ReadonlySet<string> | null;
  readonly toolInstructions: ReadonlyMap<string, string>;
};

export class ChatAgentRuntimeAccessError extends Error {
  constructor() {
    super('The selected chat agent is unavailable or you do not have access.');
    this.name = 'ChatAgentRuntimeAccessError';
  }
}

const FALLBACK_TOOL_INSTRUCTIONS = new Map<string, string>([
  [CHART_DESCRIPTION_TOOL_KEY, chartDescriptionSystemPrompt],
  [DYNAMIC_FIELDS_TOOL_KEY, dynamicFieldsSystemPrompt],
]);

export function buildFallbackChatAgentRuntime(): ResolvedChatAgentRuntime {
  return {
    agentId: null,
    instructions: systemInstruction,
    tools: aliceChatTools,
    enabledToolNames: null,
    toolInstructions: FALLBACK_TOOL_INSTRUCTIONS,
  };
}

function filterRegistryTools(enabledKeys: ReadonlySet<string>): AliceChatTools {
  return aliceChatTools.filter((tool) => enabledKeys.has(tool.name));
}

/**
 * Resolve agent instructions + enabled tools from DB.
 * Falls back to hardcoded prompts/tools when the repository is missing or no agent exists.
 */
export async function resolveChatAgentRuntime(params: {
  readonly userId: string;
  readonly agentId?: string | null;
  readonly chatAgents?: Pick<
    ChatAgentsRepository,
    | 'findVisibleById'
    | 'findActiveDefault'
    | 'listEnablementForAgents'
    | 'listActiveTools'
  > | null;
}): Promise<ResolvedChatAgentRuntime> {
  const { userId, agentId, chatAgents } = params;
  if (!chatAgents) {
    return buildFallbackChatAgentRuntime();
  }

  let agent: ChatAgentDetailRow | null;
  if (agentId) {
    agent = await chatAgents.findVisibleById(userId, agentId);
    if (agent?.status !== 'active') {
      throw new ChatAgentRuntimeAccessError();
    }
  } else {
    agent = await chatAgents.findActiveDefault();
  }

  if (!agent) {
    return buildFallbackChatAgentRuntime();
  }

  const [enablementMap, catalogTools] = await Promise.all([
    chatAgents.listEnablementForAgents([agent.id]),
    chatAgents.listActiveTools(),
  ]);
  const enablement = enablementMap.get(agent.id);
  const enabledKeys = new Set(enablement?.enabledToolKeys ?? []);
  const toolInstructions = new Map<string, string>(FALLBACK_TOOL_INSTRUCTIONS);

  for (const tool of catalogTools) {
    if (!tool.instruction) {
      continue;
    }
    try {
      toolInstructions.set(tool.key, decryptSecret(tool.instruction));
    } catch {
      // Keep fallback instruction for this key when decrypt fails.
    }
  }

  return {
    agentId: agent.id,
    instructions: decryptSecret(agent.instructions),
    tools: filterRegistryTools(enabledKeys),
    enabledToolNames: enabledKeys,
    toolInstructions,
  };
}

export function resolveSpecializedSystemInstruction(
  runtime: ResolvedChatAgentRuntime,
  toolKey: string
): string {
  return (
    runtime.toolInstructions.get(toolKey) ??
    FALLBACK_TOOL_INSTRUCTIONS.get(toolKey) ??
    runtime.instructions
  );
}
