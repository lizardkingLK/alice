import { createClient } from '@/lib/supabase/server';

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/** Custom RBAC: load role from application database once implemented. */

export async function getUserRole() {
  const user = await getUser();

  if (!user) {
    return null;
  }

  return user;
}
