import { createClient } from '@supabase/supabase-js';
import { env, getServiceRoleKey } from '@/lib/env';

export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
