import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types';

export const DASHBOARD_INBOX_LIMIT = 50;

export function fetchDashboardInboxNotifications(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(DASHBOARD_INBOX_LIMIT);
}
