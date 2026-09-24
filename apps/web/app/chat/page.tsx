import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getDbUser } from '@/lib/auth';
import { ChatClient } from './_components/chat-client';
import { ChatWorkspace } from './_components/chat-workspace';
import { getChatPageBootstrap } from './_services/chat.reads.server';
import { listChatModelsForChat } from './_services/chat-models.reads.server';
import { ChatPageSkeleton } from './_components/chat-page-skeleton';
import { parseChatPageTab } from '@/lib/search-params';

async function ChatPageData({
  conversationId,
  agentId,
}: Readonly<{ conversationId?: string; agentId?: string }>) {
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
    <ChatWorkspace
      conversation={
        <ChatClient
          key={`${conversationId ?? 'new'}:${agentId ?? ''}`}
          initialConversations={bootstrap.conversations}
          initialConversationId={bootstrap.activeConversationId}
          initialMessages={bootstrap.messages}
          initialChatModels={chatModels}
          initialAgentId={agentId}
          currentUserName={dbUser?.name}
          currentUserImageUrl={dbUser?.profile_picture}
          currentUserId={dbUser?.id}
          currentUserRole={dbUser?.role}
        />
      }
    />
  );
}

export default async function ChatPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    conversationId?: string;
    agentId?: string;
    tab?: string;
  }>;
}>) {
  const resolved = await searchParams;
  const conversationId = resolved.conversationId;
  const agentId = resolved.agentId;
  const tab = parseChatPageTab(resolved.tab);

  return (
    <DashboardShell
      description={
        tab === 'agents'
          ? 'Browse and open Alice agents to customize or chat.'
          : 'Chat with the Alice AI assistant to create projects, sprints, and work items.'
      }
      stickyHeader
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatPageData conversationId={conversationId} agentId={agentId} />
      </Suspense>
    </DashboardShell>
  );
}
