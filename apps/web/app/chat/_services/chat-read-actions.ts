'use server';

import { listChatConversationsLive } from './chat.service.server';
import type { ChatConversation } from '../_components/chat-client.types';

export type { ChatConversation } from '../_components/chat-client.types';

/**
 * Client-callable conversation list. Direct Supabase (session user), not Express.
 * Uncached so send/delete in the drawer sees the new row immediately.
 */
export async function listChatConversationsAction(): Promise<
  ChatConversation[]
> {
  return listChatConversationsLive();
}
