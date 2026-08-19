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
 * Provider avatar URL from Auth user metadata (e.g. Google `avatar_url` / `picture`).
 * Only used when inserting a new `public.users` row — never overwrites later.
 */
function resolveProfilePicture(user: User): string | null {
  const metadata = user.user_metadata ?? {};
  for (const key of ['avatar_url', 'picture'] as const) {
    const value = metadata[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Ensures a Supabase Auth user has a matching `public.users` profile.
 * Idempotent — safe after signup, email confirmation, login, and admin invite.
 * Looks up by Auth id, then email, and treats unique-constraint races as
 * “already provisioned” so a second sign-up cannot surface a primary-key error.
 * Profile picture is set only on insert from Auth metadata; later updates go
 * through `/edit-profile`.
 */
export async function ensurePublicUser(
  user: User
): Promise<{ created: boolean; error: string | null }> {
  if (!user.id || !user.email) {
    return { created: false, error: 'Auth user is missing id or email.' };
  }

  const adminSupabase = createAdminClient();

  const { data: existingById, error: lookupError } = await adminSupabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) {
    return { created: false, error: lookupError.message };
  }

  if (existingById) {
    return { created: false, error: null };
  }

  const { data: existingByEmail, error: emailLookupError } = await adminSupabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  if (emailLookupError) {
    return { created: false, error: emailLookupError.message };
  }

  if (existingByEmail) {
    return { created: false, error: null };
  }

  const { error: insertError } = await adminSupabase.from('users').insert({
    id: user.id,
    email: user.email,
    name: resolveDisplayName(user),
    role: resolveRole(user),
    profile_picture: resolveProfilePicture(user),
    active: true,
    ...auditCreate(user.id),
  });

  if (insertError) {
    if (isUniqueConstraintError(insertError)) {
      return { created: false, error: null };
    }
    return { created: false, error: insertError.message };
  }

  return { created: true, error: null };
}

function isUniqueConstraintError(error: {
  message?: string;
  code?: string;
}): boolean {
  const code = error.code ?? '';
  const message = error.message?.toLowerCase() ?? '';
  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  );
}
