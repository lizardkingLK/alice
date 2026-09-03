'use server';

import { listChatConversationsLive } from './chat.reads.server';
import type { ChatConversation } from '../_components/chat-client.types';

export type { ChatConversation } from '../_components/chat-client.types';

import { updateTag } from 'next/cache';

/**
 * Client-callable conversation list. Direct Supabase (session user), not Express.
 * Uncached so send/delete in the drawer sees the new row immediately.
 */
export async function listChatConversationsAction(): Promise<
  ChatConversation[]
> {
  return listChatConversationsLive();
}

/** Clear the server-side Next.js unstable_cache tag. */
export async function revalidateChatConversations(): Promise<void> {
  updateTag('chat-conversations');
}
