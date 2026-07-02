import type { User } from '@supabase/supabase-js';

import { auditCreate } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';

const APP_ROLES = ['admin', 'manager', 'member'] as const;
type AppRole = (typeof APP_ROLES)[number];

function resolveDisplayName(user: User): string {
  const metadataName = user.user_metadata?.name;
  if (typeof metadataName === 'string' && metadataName.trim().length >= 2) {
    return metadataName.trim();
  }

  const localPart = user.email?.split('@')[0]?.trim();
  if (localPart && localPart.length >= 2) {
    return localPart;
  }

  return 'New User';
}

function resolveRole(user: User): AppRole {
  const metadataRole = user.user_metadata?.role;
  if (
    typeof metadataRole === 'string' &&
    APP_ROLES.includes(metadataRole as AppRole)
  ) {
    return metadataRole as AppRole;
  }

  return 'member';
}

/**
 * Ensures a Supabase Auth user has a matching `public.users` profile.
 * Idempotent — safe after signup, email confirmation, login, and admin invite.
 */
export async function ensurePublicUser(
  user: User
): Promise<{ created: boolean; error: string | null }> {
  if (!user.id || !user.email) {
    return { created: false, error: 'Auth user is missing id or email.' };
  }

  const adminSupabase = createAdminClient();

  const { data: existing, error: lookupError } = await adminSupabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) {
    return { created: false, error: lookupError.message };
  }

  if (existing) {
    return { created: false, error: null };
  }

  const { error: insertError } = await adminSupabase.from('users').insert({
    id: user.id,
    email: user.email,
    name: resolveDisplayName(user),
    role: resolveRole(user),
    active: true,
    ...auditCreate(user.id),
  });

  if (insertError) {
    return { created: false, error: insertError.message };
  }

  return { created: true, error: null };
}
