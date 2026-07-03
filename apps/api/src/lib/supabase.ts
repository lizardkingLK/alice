import { env } from '../config/env';
import type { Database } from '@repo/types';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
