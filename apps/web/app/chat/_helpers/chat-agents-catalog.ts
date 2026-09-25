import {
  buildDicebearAvatarUrl,
  defaultAvatarSeedForAgent,
  isChatAgentAvatarStyle,
  type ChatAgentAvatarStyle,
} from '@/app/chat/_helpers/chat-agent-avatar';

export type ChatAgentKind = 'system' | 'personal';

export type ChatAgentAutonomy = 'suggest' | 'approve';

export type ChatAgentStatus = 'active' | 'archived';

export type ChatAgentRecord = {
  readonly id: string;
  /** Display / persona name (e.g. Alex). */
  readonly name: string;
  /** Role title shown under the name (e.g. Project Manager). */
  readonly title: string;
  readonly description: string;
  readonly instructions: string;
  readonly kind: ChatAgentKind;
  readonly autonomy: ChatAgentAutonomy;
  readonly status: ChatAgentStatus;
  readonly version: number;
  readonly forkedFromId: string | null;
  /** Short persona / tagline shown on gallery cards. */
  readonly tagline: string;
  /** Capability notes (one per line in the UI). */
  readonly skills: string;
  /** Tool allowlist notes (one per line in the UI). */
  readonly tools: string;
  /** DiceBear style (e.g. lorelei). */
  readonly avatarStyle: ChatAgentAvatarStyle;
  /** DiceBear seed — changing it regenerates the portrait. */
  readonly avatarSeed: string;
  readonly authorName: string;
  readonly authorEmail: string;
};

/** Slice 1 hardcoded author for system templates (Monday-style byline). */
export const ALICE_SYSTEM_AUTHOR = {
  name: 'Alice Admin',
  email: 'admin@alice.dev',
} as const;

export const PROJECT_MANAGER_AGENT_ID = 'system-project-manager';

export const SYSTEM_PROJECT_MANAGER: ChatAgentRecord = {
  id: PROJECT_MANAGER_AGENT_ID,
  name: 'Alex',
  title: 'Project Manager',
  description:
    'Captures goals, scope, and milestones so projects start clear and stay on track.',
  instructions: [
    'Act as a concise project manager for Alice workspaces.',
    'Prefer checklists, owners, due dates, and explicit next steps.',
    'Only use projects the user is a member of.',
    'Suggest actions first; do not assume approval to mutate unless autonomy allows it.',
  ].join('\n'),
  kind: 'system',
  autonomy: 'suggest',
  status: 'active',
  version: 1,
  forkedFromId: null,
  tagline: 'Goals, scope, milestones, and status digests',
  skills: [
    'Project briefs',
    'Milestone planning',
    'Status digests',
    'Risk and owner nags',
  ].join('\n'),
  tools: [
    'list_projects',
    'create_project',
    'list_sprints',
    'list_work_items',
  ].join('\n'),
  avatarStyle: 'lorelei',
  avatarSeed: 'alice-project-manager-v1',
  authorName: ALICE_SYSTEM_AUTHOR.name,
  authorEmail: ALICE_SYSTEM_AUTHOR.email,
};

const SEED_SYSTEM_AGENTS: readonly ChatAgentRecord[] = [SYSTEM_PROJECT_MANAGER];

/** localStorage so forks / admin system edits survive reloads (Slice 1). */
const STORED_AGENTS_KEY = 'alice.chat.personal-agents.v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function resolveAvatarFields(record: Record<string, unknown>): {
  avatarStyle: ChatAgentAvatarStyle;
  avatarSeed: string;
} {
  const style =
    typeof record.avatarStyle === 'string' &&
    isChatAgentAvatarStyle(record.avatarStyle)
      ? record.avatarStyle
      : 'lorelei';
  const name = typeof record.name === 'string' ? record.name : 'agent';
  const id = typeof record.id === 'string' ? record.id : name;
  const seed =
    typeof record.avatarSeed === 'string' && record.avatarSeed.trim()
      ? record.avatarSeed
      : defaultAvatarSeedForAgent(id, name);
  return { avatarStyle: style, avatarSeed: seed };
}

function isChatAgentRecordShape(
  value: unknown
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.description === 'string' &&
    typeof record.instructions === 'string' &&
    (record.kind === 'system' || record.kind === 'personal') &&
    (record.autonomy === 'suggest' || record.autonomy === 'approve') &&
    (record.status === 'active' || record.status === 'archived') &&
    typeof record.version === 'number' &&
    (record.forkedFromId === null || typeof record.forkedFromId === 'string') &&
    typeof record.tagline === 'string'
  );
}

function resolveAgentTitle(record: Record<string, unknown>): string {
  if (typeof record.title === 'string' && record.title.trim()) {
    return record.title.trim();
  }
  // Legacy Slice 1 rows baked the role into `name` (e.g. "Project Manager").
  const name = typeof record.name === 'string' ? record.name : '';
  if (/project manager/i.test(name)) {
    return 'Project Manager';
  }
  return '';
}

function normalizeChatAgentRecord(value: unknown): ChatAgentRecord | null {
  if (!isChatAgentRecordShape(value)) {
    return null;
  }
  const avatar = resolveAvatarFields(value);
  return {
    id: value.id as string,
    name: value.name as string,
    title: resolveAgentTitle(value),
    description: value.description as string,
    instructions: value.instructions as string,
    kind: value.kind as ChatAgentKind,
    autonomy: value.autonomy as ChatAgentAutonomy,
    status: value.status as ChatAgentStatus,
    version: value.version as number,
    forkedFromId: value.forkedFromId as string | null,
    tagline: value.tagline as string,
    skills: typeof value.skills === 'string' ? value.skills : '',
    tools: typeof value.tools === 'string' ? value.tools : '',
    avatarStyle: avatar.avatarStyle,
    avatarSeed: avatar.avatarSeed,
    authorName:
      typeof value.authorName === 'string' && value.authorName.trim()
        ? value.authorName
        : ALICE_SYSTEM_AUTHOR.name,
    authorEmail:
      typeof value.authorEmail === 'string' && value.authorEmail.trim()
        ? value.authorEmail
        : ALICE_SYSTEM_AUTHOR.email,
  };
}

function parseStoredAgentsJson(raw: string): ChatAgentRecord[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map(normalizeChatAgentRecord)
    .filter((agent): agent is ChatAgentRecord => agent !== null);
}

function readStoredAgents(): ChatAgentRecord[] {
  if (!isBrowser()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORED_AGENTS_KEY);
    if (!raw) {
      const legacy = window.sessionStorage.getItem(STORED_AGENTS_KEY);
      if (legacy) {
        window.localStorage.setItem(STORED_AGENTS_KEY, legacy);
        window.sessionStorage.removeItem(STORED_AGENTS_KEY);
        return parseStoredAgentsJson(legacy);
      }
      return [];
    }
    return parseStoredAgentsJson(raw);
  } catch {
    return [];
  }
}

function writeStoredAgents(agents: readonly ChatAgentRecord[]): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(STORED_AGENTS_KEY, JSON.stringify(agents));
  window.dispatchEvent(new Event('alice-chat-agents-changed'));
}

export function resolveChatAgentAvatarUrl(
  agent: Pick<ChatAgentRecord, 'avatarStyle' | 'avatarSeed'>,
  size?: number
): string {
  return buildDicebearAvatarUrl({
    style: agent.avatarStyle,
    seed: agent.avatarSeed,
    size,
  });
}

export function upsertStoredAgent(agent: ChatAgentRecord): ChatAgentRecord {
  const existing = readStoredAgents();
  const without = existing.filter((row) => row.id !== agent.id);
  writeStoredAgents([...without, agent]);
  return agent;
}

export function listSystemAgents(): readonly ChatAgentRecord[] {
  const stored = readStoredAgents();
  const storedSystem = stored.filter(
    (agent) => agent.kind === 'system' && agent.status === 'active'
  );
  const byId = new Map(storedSystem.map((agent) => [agent.id, agent]));
  const mergedSeed = SEED_SYSTEM_AGENTS.map(
    (seed) => byId.get(seed.id) ?? seed
  );
  const seedIds = new Set(SEED_SYSTEM_AGENTS.map((seed) => seed.id));
  const extraSystem = storedSystem.filter((agent) => !seedIds.has(agent.id));
  return [...mergedSeed, ...extraSystem];
}

export function listPersonalAgents(): readonly ChatAgentRecord[] {
  return readStoredAgents().filter((agent) => agent.kind === 'personal');
}

export function getChatAgentById(agentId: string): ChatAgentRecord | null {
  const stored = readStoredAgents().find((agent) => agent.id === agentId);
  if (stored) {
    return stored;
  }
  return SEED_SYSTEM_AGENTS.find((agent) => agent.id === agentId) ?? null;
}

export function listMineGalleryAgents(): readonly ChatAgentRecord[] {
  const personalActive = listPersonalAgents().filter(
    (agent) => agent.status === 'active'
  );
  return [...listSystemAgents(), ...personalActive];
}

export function listSharedGalleryAgents(): readonly ChatAgentRecord[] {
  return [];
}

export function listArchivedGalleryAgents(): readonly ChatAgentRecord[] {
  return readStoredAgents().filter((agent) => agent.status === 'archived');
}

/** @deprecated Prefer upsertStoredAgent — kept for call-site clarity. */
export function upsertPersonalAgent(agent: ChatAgentRecord): ChatAgentRecord {
  return upsertStoredAgent(agent);
}

export function forkChatAgent(
  source: ChatAgentRecord,
  author?: { readonly name: string; readonly email?: string }
): ChatAgentRecord | null {
  if (source.kind !== 'system') {
    return null;
  }
  const forkedId = `personal-${source.id}-${Date.now()}`;
  const authorName = author?.name?.trim() || ALICE_SYSTEM_AUTHOR.name;
  const authorEmail = author?.email?.trim() || ALICE_SYSTEM_AUTHOR.email;
  const forked: ChatAgentRecord = {
    ...source,
    id: forkedId,
    name: `${source.name} (copy)`,
    kind: 'personal',
    status: 'active',
    version: source.version + 1,
    forkedFromId: source.id,
    avatarStyle: source.avatarStyle,
    avatarSeed: `${source.avatarSeed}-v${source.version + 1}`,
    authorName,
    authorEmail,
  };
  return upsertStoredAgent(forked);
}

/** Slice 1: personal forks in this browser belong to the signed-in user. */
export function claimPersonalAgentAuthor(
  agentId: string,
  author: { readonly name: string; readonly email?: string }
): ChatAgentRecord | null {
  const current = getChatAgentById(agentId);
  if (current?.kind !== 'personal') {
    return null;
  }
  const authorName = author.name.trim();
  if (!authorName) {
    return null;
  }
  if (
    current.authorName === authorName &&
    (!author.email || current.authorEmail === author.email.trim())
  ) {
    return current;
  }
  // Only rewrite the legacy system-author stamp from early forks.
  if (current.authorName !== ALICE_SYSTEM_AUTHOR.name) {
    return current;
  }
  return upsertStoredAgent({
    ...current,
    authorName,
    authorEmail: author.email?.trim() || current.authorEmail,
  });
}

export type ChatAgentDraftPatch = Partial<
  Pick<
    ChatAgentRecord,
    | 'name'
    | 'title'
    | 'description'
    | 'instructions'
    | 'autonomy'
    | 'tagline'
    | 'skills'
    | 'tools'
    | 'status'
    | 'avatarStyle'
    | 'avatarSeed'
  >
>;

export function saveAgentDraft(
  agentId: string,
  patch: ChatAgentDraftPatch,
  options?: { readonly allowSystemEdit?: boolean }
): ChatAgentRecord | null {
  const current = getChatAgentById(agentId);
  if (!current) {
    return null;
  }
  if (current.kind === 'system' && !options?.allowSystemEdit) {
    return null;
  }
  if (current.status === 'archived' && patch.status !== 'active') {
    return null;
  }
  const next: ChatAgentRecord = {
    ...current,
    ...patch,
  };
  return upsertStoredAgent(next);
}

/** Promote a personal agent to a forkable system template (admin). */
export function markAgentAsSystem(agentId: string): ChatAgentRecord | null {
  const current = getChatAgentById(agentId);
  if (current?.kind !== 'personal') {
    return null;
  }
  const next: ChatAgentRecord = {
    ...current,
    kind: 'system',
    forkedFromId: null,
    authorName: ALICE_SYSTEM_AUTHOR.name,
    authorEmail: ALICE_SYSTEM_AUTHOR.email,
  };
  return upsertStoredAgent(next);
}

function setPersonalAgentStatus(
  agentId: string,
  status: ChatAgentStatus
): ChatAgentRecord | null {
  const current = getChatAgentById(agentId);
  if (current?.kind !== 'personal') {
    return null;
  }
  if (current.status === status) {
    return current;
  }
  return upsertStoredAgent({ ...current, status });
}

/** Soft-archive a personal agent (Mine → Archived). */
export function archivePersonalAgent(agentId: string): ChatAgentRecord | null {
  return setPersonalAgentStatus(agentId, 'archived');
}

/** Restore an archived personal agent to Mine. */
export function restorePersonalAgent(agentId: string): ChatAgentRecord | null {
  return setPersonalAgentStatus(agentId, 'active');
}

/** Permanently delete a personal agent from this browser. */
export function deletePersonalAgent(agentId: string): boolean {
  const current = getChatAgentById(agentId);
  if (current?.kind !== 'personal') {
    return false;
  }
  const existing = readStoredAgents();
  const next = existing.filter((row) => row.id !== agentId);
  if (next.length === existing.length) {
    return false;
  }
  writeStoredAgents(next);
  return true;
}

export function savePersonalAgentDraft(
  agentId: string,
  patch: ChatAgentDraftPatch
): ChatAgentRecord | null {
  return saveAgentDraft(agentId, patch, { allowSystemEdit: false });
}

export function subscribeChatAgentsCatalog(
  onStoreChange: () => void
): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORED_AGENTS_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('alice-chat-agents-changed', onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('alice-chat-agents-changed', onStoreChange);
  };
}
