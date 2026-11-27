'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/rbac/require-role';
import type { User } from '@/app/users/_services/users.mutations.shared';

/**
 * Admin lookup for project Quick create: resolve a registry user by email
 * (including pending invitees who are hidden from product-usable dropdowns).
 */
export async function resolveUserByEmail(email: string): Promise<User | null> {
  const auth = await requireAdmin(
    'Unauthorized. Only administrators can look up users.'
  );
  if (!auth.allowed) {
    throw new Error(auth.error);
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const supabase = createAdminClient();
  // Case-insensitive match — registry emails are normally lowercased on write.
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', normalized)
    .maybeSingle();

  if (error) {
    console.error('error. failed to resolve user by email:', error.message);
    throw new Error('Failed to look up user by email.');
  }

  return (data as User | null) ?? null;
}
