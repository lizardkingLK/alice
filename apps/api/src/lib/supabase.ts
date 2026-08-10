import { env } from '../config/env';
import type { Database } from '@repo/types';
import { createClient } from '@supabase/supabase-js';

/** Re-export so API modules import createClient from this module, not @supabase/supabase-js directly. */
export { createClient };

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
