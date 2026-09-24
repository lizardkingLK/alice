/** DiceBear styles suitable for Alice agent character portraits. */
export const CHAT_AGENT_AVATAR_STYLES = [
  'lorelei',
  'notionists',
  'personas',
  'avataaars',
  'adventurer',
  'open-peeps',
] as const;

export type ChatAgentAvatarStyle = (typeof CHAT_AGENT_AVATAR_STYLES)[number];

export function isChatAgentAvatarStyle(
  value: string
): value is ChatAgentAvatarStyle {
  return (CHAT_AGENT_AVATAR_STYLES as readonly string[]).includes(value);
}

export function buildDicebearAvatarUrl(params: {
  readonly style: ChatAgentAvatarStyle;
  readonly seed: string;
  readonly size?: number;
}): string {
  const seed = encodeURIComponent(params.seed.trim() || 'alice-agent');
  const size = params.size ?? 256;
  return `https://api.dicebear.com/9.x/${params.style}/png?seed=${seed}&size=${size}`;
}

export function defaultAvatarSeedForAgent(agentId: string, name: string): string {
  return name.trim() || agentId;
}
