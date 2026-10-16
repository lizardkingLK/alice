'use client';

import { createClient } from '@/lib/supabase/client';
import { throwIfError } from '@/lib/db/query';
import type { ChatConversation } from '@/app/chat/_components/chat-client.types';

/**
 * Browser-side conversation list (RLS). Prefer this from client effects over
 * `listChatConversationsAction`: Server Actions that touch auth cookies
 * re-render the current route and can remount Suspense children in a loop
 * (Overview Alice widget on `/dashboard`).
 */
export async function listChatConversationsClient(): Promise<
  ChatConversation[]
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, created_at, updated_at, is_processing')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  throwIfError(
    error,
    'failed to list chat conversations',
    'Failed to list conversations'
  );

  return data ?? [];
}
