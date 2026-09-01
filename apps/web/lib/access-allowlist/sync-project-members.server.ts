import { auditCreate, auditUpdate } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { RecordStatusEnum, type Json, type Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient<Database>;

function parseAllowlistProjectKeys(
  value: Json | readonly string[] | null | undefined
): string[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }
  const keys = value
    .map(String)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function normalizeProjectKeys(keys: readonly string[]): string[] {
  return [
    ...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean)),
  ];
}

function logProvisionError(scope: string, message: string): void {
  console.error(`error. ${scope}:`, message);
}

async function fetchActiveEmailAllowlistEntry(
  admin: AdminClient,
  normalizedEmail: string
) {
  const { data, error } = await admin
    .from('access_allowlist')
    .select('allowed_project_ids, status, kind')
    .eq('kind', 'email')
    .eq('value', normalizedEmail)
    .eq('status', RecordStatusEnum.active)
    .maybeSingle();

  if (error) {
    logProvisionError(
      'allowlist lookup for project member provision failed',
      error.message
    );
    return null;
  }

  return data;
}

async function fetchProjectIdByKey(
  admin: AdminClient
): Promise<Map<string, string> | null> {
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, key');

  if (error) {
    logProvisionError(
      'project lookup for allowlist member provision failed',
      error.message
    );
    return null;
  }

  const projectIdByKey = new Map<string, string>();
  for (const project of projects ?? []) {
    projectIdByKey.set(project.key.toUpperCase(), project.id);
  }
  return projectIdByKey;
}

async function ensureActiveProjectMember(
  admin: AdminClient,
  params: { readonly userId: string; readonly projectId: string }
): Promise<void> {
  const { data: existing, error: memberLookupError } = await admin
    .from('project_members')
    .select('status')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (memberLookupError) {
    logProvisionError(
      'project member lookup during allowlist provision failed',
      memberLookupError.message
    );
    return;
  }

  if (!existing) {
    const { error: insertError } = await admin.from('project_members').insert({
      project_id: params.projectId,
      user_id: params.userId,
      ...auditCreate(params.userId),
    });
    if (insertError) {
      logProvisionError(
        'project member insert during allowlist provision failed',
        insertError.message
      );
    }
    return;
  }

  if (existing.status === RecordStatusEnum.active) {
    return;
  }

  const { error: updateError } = await admin
    .from('project_members')
    .update({
      status: RecordStatusEnum.active,
      ...auditUpdate(params.userId),
    })
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId);

  if (updateError) {
    logProvisionError(
      'project member reactivation during allowlist provision failed',
      updateError.message
    );
  }
}

/**
 * After Auth provisioning, ensure active allowlist project keys have
 * matching `project_members` rows (signup-before-allowlist-save ordering).
 */
export async function provisionAllowlistProjectMembersForUser(params: {
  readonly userId: string;
  readonly email: string;
}): Promise<void> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const admin = createAdminClient();

  const entry = await fetchActiveEmailAllowlistEntry(admin, normalizedEmail);
  if (!entry) {
    return;
  }

  const keys = normalizeProjectKeys(
    parseAllowlistProjectKeys(entry.allowed_project_ids)
  );
  if (keys.length === 0) {
    return;
  }

  const projectIdByKey = await fetchProjectIdByKey(admin);
  if (!projectIdByKey) {
    return;
  }

  for (const key of keys) {
    const projectId = projectIdByKey.get(key);
    if (!projectId) {
      continue;
    }

    await ensureActiveProjectMember(admin, {
      userId: params.userId,
      projectId,
    });
  }
}
