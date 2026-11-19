import { env } from '../config/env';
import type { Database } from '@repo/types';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

/** Re-export so API modules import createClient from this module, not @supabase/supabase-js directly. */
export { createClient };

/**
 * Node < 22 has no global WebSocket; supabase-js realtime requires an explicit
 * transport (see @supabase/realtime-js websocket-factory).
 */
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  }
);
