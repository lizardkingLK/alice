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

async function upsertChatTools(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();

  for (const tool of SEED_CHAT_TOOLS) {
    const instruction =
      tool.instruction !== undefined ? encryptSecret(tool.instruction) : null;

    const { data: existing, error: lookupError } = await supabase
      .from('chat_tools')
      .select('id')
      .eq('key', tool.key)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Failed to lookup chat_tools.${tool.key}: ${lookupError.message}`
      );
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('chat_tools')
        .update({
          label: tool.label,
          description: tool.description,
          instruction,
          sort_order: tool.sortOrder,
          status: RecordStatusEnum.active,
          updated_at: nowIso(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(
          `Failed to update chat_tools.${tool.key}: ${updateError.message}`
        );
      }

      idByKey.set(tool.key, existing.id);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('chat_tools')
      .insert({
        key: tool.key,
        label: tool.label,
        description: tool.description,
        instruction,
        sort_order: tool.sortOrder,
        status: RecordStatusEnum.active,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(
        `Failed to insert chat_tools.${tool.key}: ${insertError?.message ?? 'missing id'}`
      );
    }

    idByKey.set(tool.key, inserted.id);
  }

  return idByKey;
}

async function upsertChatSkills(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();

  for (const skill of SEED_CHAT_SKILLS) {
    const { data: existing, error: lookupError } = await supabase
      .from('chat_skills')
      .select('id')
      .eq('key', skill.key)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Failed to lookup chat_skills.${skill.key}: ${lookupError.message}`
      );
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('chat_skills')
        .update({
          label: skill.label,
          description: skill.description,
          sort_order: skill.sortOrder,
          status: RecordStatusEnum.active,
          updated_at: nowIso(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(
          `Failed to update chat_skills.${skill.key}: ${updateError.message}`
        );
      }

      idByKey.set(skill.key, existing.id);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('chat_skills')
      .insert({
        key: skill.key,
        label: skill.label,
        description: skill.description,
        sort_order: skill.sortOrder,
        status: RecordStatusEnum.active,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(
        `Failed to insert chat_skills.${skill.key}: ${insertError?.message ?? 'missing id'}`
      );
    }

    idByKey.set(skill.key, inserted.id);
  }

  return idByKey;
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

async function ensureAgentToolLinks(
  supabase: SupabaseClient,
  agentId: string,
  toolIds: Map<string, string>
): Promise<void> {
  for (const toolId of toolIds.values()) {
    const { data: existing, error: lookupError } = await supabase
      .from('chat_agent_tools')
      .select('id, enabled')
      .eq('agent_id', agentId)
      .eq('tool_id', toolId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Failed to lookup chat_agent_tools: ${lookupError.message}`
      );
    }

    if (existing?.id) {
      if (existing.enabled) {
        continue;
      }
      const { error: updateError } = await supabase
        .from('chat_agent_tools')
        .update({ enabled: true, updated_at: nowIso() })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(
          `Failed to enable chat_agent_tools: ${updateError.message}`
        );
      }
      continue;
    }

    const { error: insertError } = await supabase
      .from('chat_agent_tools')
      .insert({
        agent_id: agentId,
        tool_id: toolId,
        enabled: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      });

    if (insertError) {
      throw new Error(
        `Failed to insert chat_agent_tools: ${insertError.message}`
      );
    }
  }
}

async function ensureAgentSkillLinks(
  supabase: SupabaseClient,
  agentId: string,
  skillIds: Map<string, string>
): Promise<void> {
  for (const skillId of skillIds.values()) {
    const { data: existing, error: lookupError } = await supabase
      .from('chat_agent_skills')
      .select('id, enabled')
      .eq('agent_id', agentId)
      .eq('skill_id', skillId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(
        `Failed to lookup chat_agent_skills: ${lookupError.message}`
      );
    }

    if (existing?.id) {
      if (existing.enabled) {
        continue;
      }
      const { error: updateError } = await supabase
        .from('chat_agent_skills')
        .update({ enabled: true, updated_at: nowIso() })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(
          `Failed to enable chat_agent_skills: ${updateError.message}`
        );
      }
      continue;
    }

    const { error: insertError } = await supabase
      .from('chat_agent_skills')
      .insert({
        agent_id: agentId,
        skill_id: skillId,
        enabled: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      });

    if (insertError) {
      throw new Error(
        `Failed to insert chat_agent_skills: ${insertError.message}`
      );
    }
  }
}

/** Idempotent seed: catalogs + default Alice agent (encrypted instructions). */
export async function seedChatAgents(
  supabase: SupabaseClient,
  adminId: string
): Promise<void> {
  const toolIds = await upsertChatTools(supabase);
  const skillIds = await upsertChatSkills(supabase);
  const agentId = await ensureAliceDefaultAgent(supabase, adminId);
  await ensureAgentToolLinks(supabase, agentId, toolIds);
  await ensureAgentSkillLinks(supabase, agentId, skillIds);
}
