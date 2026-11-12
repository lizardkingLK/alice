import { agentIdFromMentionId, type Json } from '@repo/types';

export type ExtractedAgentMention = {
  readonly id: string;
  readonly agentId: string;
  readonly label: string;
};

function parseDocJson(content: Json | string | null | undefined): unknown {
  if (!content) return null;
  if (typeof content !== 'string') return content;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractMentionNode(node: unknown): ExtractedAgentMention | null {
  if (typeof node !== 'object' || node === null) return null;
  const candidate = node as {
    type?: unknown;
    attrs?: { id?: unknown; label?: unknown; mentionType?: unknown };
  };

  if (candidate.type !== 'mention' || !candidate.attrs) return null;
  const attrs = candidate.attrs;
  const isAgent =
    attrs.mentionType === 'agent' ||
    (typeof attrs.id === 'string' && attrs.id.startsWith('agent:'));

  if (!isAgent || typeof attrs.id !== 'string') return null;

  const rawId = attrs.id;
  const agentId = agentIdFromMentionId(rawId) ?? rawId;
  const label =
    typeof attrs.label === 'string' && attrs.label.trim()
      ? attrs.label.trim()
      : 'AI agent';

  return { id: rawId, agentId, label };
}

export function extractAgentMentionsFromDoc(
  content: Json | string | null | undefined
): ExtractedAgentMention[] {
  const doc = parseDocJson(content);
  if (typeof doc !== 'object' || doc === null) return [];

  const mentions: ExtractedAgentMention[] = [];
  const seenIds = new Set<string>();
  const stack: unknown[] = [doc];

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== 'object' || current === null) continue;

    const mention = extractMentionNode(current);
    if (mention && !seenIds.has(mention.agentId)) {
      seenIds.add(mention.agentId);
      mentions.push(mention);
    }

    const container = current as { content?: unknown[] };
    if (Array.isArray(container.content)) {
      for (const child of container.content) {
        stack.push(child);
      }
    }
  }

  return mentions;
}
