import type { Database } from '@repo/types';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
