import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types';

export const DASHBOARD_INBOX_LIMIT = 50;
export const NOTIFICATIONS_PAGE_LIMIT = 100;

export function fetchDashboardInboxNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = DASHBOARD_INBOX_LIMIT
) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
}
