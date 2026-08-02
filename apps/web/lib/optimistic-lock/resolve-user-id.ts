import { createClient } from '@/lib/supabase/client';

/** Prefer an explicit prop; otherwise read the signed-in user from Supabase Auth. */
export async function resolveCurrentUserId(
  currentUserId?: string | null
): Promise<string | null> {
  if (currentUserId) {
    return currentUserId;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
