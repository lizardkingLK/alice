import {
  auditCreateWithoutStatus,
  auditUpdate,
  RecordStatusEnum,
} from '@repo/types/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

import { encryptSecret, isEncryptedSecret } from './seed-crypto.js';
import {
  ALICE_DEFAULT_AGENT,
  ALICE_DEFAULT_AGENT_KEY,
  ALICE_DEFAULT_INSTRUCTIONS,
  SEED_CHAT_SKILLS,
  SEED_CHAT_TOOLS,
} from './seed-chat-agents-data.js';

function nowIso(): string {
  return new Date().toISOString();
}

type SeedCatalogRow = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly sortOrder: number;
  readonly instruction?: string;
};

async function upsertCatalogRow(
  supabase: SupabaseClient,
  table: 'chat_tools' | 'chat_skills',
  row: SeedCatalogRow,
  options: { encryptInstruction: boolean }
): Promise<[string, string]> {
  const fields: Record<string, unknown> = {
    label: row.label,
    description: row.description,
    sort_order: row.sortOrder,
    status: RecordStatusEnum.active,
    updated_at: nowIso(),
  };
  if (options.encryptInstruction) {
    fields.instruction =
      row.instruction !== undefined ? encryptSecret(row.instruction) : null;
  }

  const { data: existing, error: lookupError } = await supabase
    .from(table)
    .select('id')
    .eq('key', row.key)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to lookup ${table}.${row.key}: ${lookupError.message}`
    );
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from(table)
      .update(fields)
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(
        `Failed to update ${table}.${row.key}: ${updateError.message}`
      );
    }

    return [row.key, existing.id];
  }

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert({
      key: row.key,
      ...fields,
      created_at: nowIso(),
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(
      `Failed to insert ${table}.${row.key}: ${insertError?.message ?? 'missing id'}`
    );
  }

  return [row.key, inserted.id];
}

async function upsertChatCatalog(
  supabase: SupabaseClient,
  table: 'chat_tools' | 'chat_skills',
  rows: readonly SeedCatalogRow[],
  options: { encryptInstruction: boolean }
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    rows.map((row) => upsertCatalogRow(supabase, table, row, options))
  );
  return new Map(entries);
}

async function ensureAliceDefaultAgent(
  supabase: SupabaseClient,
  adminId: string
): Promise<string> {
  const { data: existing, error: lookupError } = await supabase
    .from('chat_agents')
    .select('id, instructions')
    .eq('key', ALICE_DEFAULT_AGENT_KEY)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to lookup chat_agents.${ALICE_DEFAULT_AGENT_KEY}: ${lookupError.message}`
    );
  }

  const personaFields = {
    name: ALICE_DEFAULT_AGENT.name,
    title: ALICE_DEFAULT_AGENT.title,
    description: ALICE_DEFAULT_AGENT.description,
    tagline: ALICE_DEFAULT_AGENT.tagline,
    autonomy: ALICE_DEFAULT_AGENT.autonomy,
    avatar_style: ALICE_DEFAULT_AGENT.avatarStyle,
    avatar_seed: ALICE_DEFAULT_AGENT.avatarSeed,
    owner_id: null,
    forked_from_id: null,
    is_default: true,
    status: RecordStatusEnum.active,
    version: 1,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('chat_agents')
      .update({
        ...personaFields,
        ...auditUpdate(adminId),
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(
        `Failed to update chat_agents.${ALICE_DEFAULT_AGENT_KEY}: ${updateError.message}`
      );
    }

    // Preserve admin-customized instructions; only encrypt seed text on first insert
    // or when a legacy plaintext row is found.
    if (
      typeof existing.instructions === 'string' &&
      !isEncryptedSecret(existing.instructions)
    ) {
      const { error: encryptError } = await supabase
        .from('chat_agents')
        .update({
          instructions: encryptSecret(existing.instructions),
          ...auditUpdate(adminId),
        })
        .eq('id', existing.id);

      if (encryptError) {
        throw new Error(
          `Failed to encrypt existing chat_agents.${ALICE_DEFAULT_AGENT_KEY} instructions: ${encryptError.message}`
        );
      }
    }

    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('chat_agents')
    .insert({
      key: ALICE_DEFAULT_AGENT_KEY,
      instructions: encryptSecret(ALICE_DEFAULT_INSTRUCTIONS),
      ...personaFields,
      ...auditCreateWithoutStatus(adminId),
      created_at: nowIso(),
    })
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(
      `Failed to insert chat_agents.${ALICE_DEFAULT_AGENT_KEY}: ${insertError?.message ?? 'missing id'}`
    );
  }

  return inserted.id;
}

async function ensureAgentCatalogLink(
  supabase: SupabaseClient,
  agentId: string,
  targetId: string,
  config: {
    table: 'chat_agent_tools' | 'chat_agent_skills';
    foreignKey: 'tool_id' | 'skill_id';
  }
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from(config.table)
    .select('id, enabled')
    .eq('agent_id', agentId)
    .eq(config.foreignKey, targetId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to lookup ${config.table}: ${lookupError.message}`);
  }

  if (existing?.id) {
    if (existing.enabled) {
      return;
    }
    const { error: updateError } = await supabase
      .from(config.table)
      .update({ enabled: true, updated_at: nowIso() })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(
        `Failed to enable ${config.table}: ${updateError.message}`
      );
    }
    return;
  }

  const { error: insertError } = await supabase.from(config.table).insert({
    agent_id: agentId,
    [config.foreignKey]: targetId,
    enabled: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  if (insertError) {
    throw new Error(`Failed to insert ${config.table}: ${insertError.message}`);
  }
}

async function ensureAgentCatalogLinks(
  supabase: SupabaseClient,
  agentId: string,
  targetIds: Map<string, string>,
  config: {
    table: 'chat_agent_tools' | 'chat_agent_skills';
    foreignKey: 'tool_id' | 'skill_id';
  }
): Promise<void> {
  await Promise.all(
    [...targetIds.values()].map((targetId) =>
      ensureAgentCatalogLink(supabase, agentId, targetId, config)
    )
  );
}

/** Idempotent seed: catalogs + default Alice agent (encrypted instructions). */
export async function seedChatAgents(
  supabase: SupabaseClient,
  adminId: string
): Promise<void> {
  const toolIds = await upsertChatCatalog(
    supabase,
    'chat_tools',
    SEED_CHAT_TOOLS,
    { encryptInstruction: true }
  );
  const skillIds = await upsertChatCatalog(
    supabase,
    'chat_skills',
    SEED_CHAT_SKILLS,
    { encryptInstruction: false }
  );
  const agentId = await ensureAliceDefaultAgent(supabase, adminId);
  await ensureAgentCatalogLinks(supabase, agentId, toolIds, {
    table: 'chat_agent_tools',
    foreignKey: 'tool_id',
  });
  await ensureAgentCatalogLinks(supabase, agentId, skillIds, {
    table: 'chat_agent_skills',
    foreignKey: 'skill_id',
  });
}
