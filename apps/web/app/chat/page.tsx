import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getDbUser } from '@/lib/auth';
import { ChatClient } from './_components/chat-client';
import { getChatPageBootstrap } from './_services/chat.reads.server';
import { listChatModelsForChat } from './_services/chat-models.reads.server';
import { ChatPageSkeleton } from './_components/chat-page-skeleton';
import {
  CHAT_HISTORY_SIDEBAR_COOKIE_NAME,
  parseChatHistorySidebarOpenCookie,
} from './_helpers/chat-history-sidebar-storage';

async function readChatHistorySidebarDefaultOpen(): Promise<boolean> {
  const store = await cookies();
  return parseChatHistorySidebarOpenCookie(
    store.get(CHAT_HISTORY_SIDEBAR_COOKIE_NAME)?.value
  );
}

async function ChatPageData({
  conversationId,
  agentId,
  initialHistoryOpen,
}: Readonly<{
  conversationId?: string;
  agentId?: string;
  initialHistoryOpen: boolean;
}>) {
  const [bootstrapResult, chatModels, dbUser] = await Promise.all([
    safeServerFetch(
      getChatPageBootstrap(conversationId),
      { ok: true as const, data: { conversations: [], messages: [] } },
      'fetch chat page bootstrap'
    ),
    safeServerFetch(listChatModelsForChat(), [], 'fetch chat models'),
    getDbUser(),
  ]);

  if (!bootstrapResult.ok) {
    notFound();
  }

  const bootstrap = bootstrapResult.data;

  return (
    <ChatClient
      key={`${conversationId ?? 'new'}:${agentId ?? ''}`}
      initialConversations={bootstrap.conversations}
      initialConversationId={bootstrap.activeConversationId}
      initialMessages={bootstrap.messages}
      initialChatModels={chatModels}
      initialAgentId={agentId}
      initialHistoryOpen={initialHistoryOpen}
      currentUserName={dbUser?.name}
      currentUserEmail={dbUser?.email}
      currentUserImageUrl={dbUser?.profile_picture}
      currentUserId={dbUser?.id}
      currentUserRole={dbUser?.role}
    />
  );
}

export default async function ChatPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    conversationId?: string;
    agentId?: string;
  }>;
}>) {
  const resolved = await searchParams;
  const conversationId = resolved.conversationId;
  const agentId = resolved.agentId;
  const initialHistoryOpen = await readChatHistorySidebarDefaultOpen();

  return (
    <DashboardShell
      description="Chat with the Alice AI assistant to create projects, sprints, and work items."
      stickyHeader
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatPageData
          conversationId={conversationId}
          agentId={agentId}
          initialHistoryOpen={initialHistoryOpen}
        />
      </Suspense>
    </DashboardShell>
  );
}
