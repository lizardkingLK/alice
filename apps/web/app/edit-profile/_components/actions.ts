'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';
import { createClient } from '@/lib/supabase/server';
import { toggleUserActive as apiToggleUserActive } from '@/app/users/_services/users.service.server';
import { ApiError } from '@/lib/api/api';

export type DeactivateAccountState = {
  success: boolean;
  error: string | null;
};

/**
 * Self-deactivate via the shared `PATCH /api/users/:id/toggle-active` API,
 * then sign out. Reactivation requires an administrator.
 */
export async function deactivateMyAccount(
  _prev: DeactivateAccountState | null,
  formData: FormData
): Promise<DeactivateAccountState> {
  const confirmation = String(formData.get('confirmation') ?? '').trim();
  const expectedUpdatedAt = String(formData.get('expectedUpdatedAt') ?? '');

  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  if (confirmation.toLowerCase() !== currentUser.email.toLowerCase()) {
    return {
      success: false,
      error: 'Type your email address exactly to confirm deactivation.',
    };
  }

  if (!expectedUpdatedAt) {
    return {
      success: false,
      error: 'Missing account version. Refresh and try again.',
    };
  }

  try {
    await apiToggleUserActive(currentUser.id, false, expectedUpdatedAt);
  } catch (err) {
    let message = 'Failed to deactivate account.';
    if (err instanceof ApiError || err instanceof Error) {
      message = err.message;
    }
    return { success: false, error: message };
  }

  invalidateDropdownCache(DROPDOWN_CACHE_TAGS.users);
  revalidatePath('/users');
  revalidatePath('/edit-profile');
  revalidatePath('/profile');

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/?account=closed');
}
