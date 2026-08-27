import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getDbUser } from '@/lib/auth';
import { ChatClient } from './_components/chat-client';
import { getChatPageBootstrap } from './_services/chat.service.server';
import { ChatPageSkeleton } from './_components/chat-page-skeleton';

export const metadata = {
  title: 'Alice',
};

async function ChatPageData({
  conversationId,
}: Readonly<{ conversationId?: string }>) {
  const [bootstrap, dbUser] = await Promise.all([
    safeServerFetch(
      getChatPageBootstrap(conversationId),
      { conversations: [], messages: [] },
      'fetch chat page bootstrap'
    ),
    getDbUser(),
  ]);

  return (
    <ChatClient
      initialConversations={bootstrap.conversations}
      initialConversationId={bootstrap.activeConversationId}
      initialMessages={bootstrap.messages}
      currentUserName={dbUser?.name}
      currentUserImageUrl={dbUser?.profile_picture}
      currentUserId={dbUser?.id}
    />
  );
}

export default async function ChatPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ conversationId?: string }>;
}>) {
  const { conversationId } = await searchParams;

  return (
    <DashboardShell
      description="Chat with the Alice AI assistant to create projects, sprints, and work items."
      stickyHeader
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <Suspense fallback={<ChatPageSkeleton />}>
        <ChatPageData conversationId={conversationId} />
      </Suspense>
    </DashboardShell>
  );
}
