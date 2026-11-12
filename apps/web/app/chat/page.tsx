import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getDbUser } from '@/lib/auth';
import { ChatClient } from './_components/chat-client';
import { getChatPageBootstrap } from './_services/chat.reads.server';
import { resolveOverviewChatAgentsBootstrap } from './_services/chat-agents.reads.server';
import { listChatModelsForChat } from './_services/chat-models.reads.server';
import { ChatPageSkeleton } from './_components/chat-page-skeleton';
import {
  CHAT_HISTORY_SIDEBAR_COOKIE_NAME,
  parseChatHistorySidebarOpenCookie,
} from './_helpers/chat-history-sidebar-storage';
import {
  PREFERRED_CHAT_AGENT_COOKIE_NAME,
  parsePreferredChatAgentCookie,
} from './_helpers/preferred-chat-agent-storage';

async function readChatPageCookies(): Promise<{
  historyOpen: boolean;
  preferredAgentId: string | null;
}> {
  const store = await cookies();
  return {
    historyOpen: parseChatHistorySidebarOpenCookie(
      store.get(CHAT_HISTORY_SIDEBAR_COOKIE_NAME)?.value
    ),
    preferredAgentId: parsePreferredChatAgentCookie(
      store.get(PREFERRED_CHAT_AGENT_COOKIE_NAME)?.value
    ),
  };
}

async function ChatPageData({
  conversationId,
  agentId,
  preferredAgentId,
  initialHistoryOpen,
}: Readonly<{
  conversationId?: string;
  agentId?: string;
  preferredAgentId: string | null;
  initialHistoryOpen: boolean;
}>) {
  const [bootstrapResult, chatModels, agentsBootstrap, dbUser] =
    await Promise.all([
      safeServerFetch(
        getChatPageBootstrap(conversationId),
        { ok: true as const, data: { conversations: [], messages: [] } },
        'fetch chat page bootstrap'
      ),
      safeServerFetch(listChatModelsForChat(), [], 'fetch chat models'),
      safeServerFetch(
        resolveOverviewChatAgentsBootstrap(),
        { agents: [], preferredAgentId: null },
        'fetch chat agents for chat page'
      ),
      getDbUser(),
    ]);

  if (!bootstrapResult.ok) {
    notFound();
  }

  const bootstrap = bootstrapResult.data;
  const activeConversation = bootstrap.conversations.find(
    (row) => row.id === bootstrap.activeConversationId
  );
  const agentIds = new Set(
    agentsBootstrap.agents.map((agent) => agent.agentId)
  );
  const conversationAgentId = activeConversation?.agent_id ?? undefined;
  const validPreferredAgentId =
    preferredAgentId && agentIds.has(preferredAgentId)
      ? preferredAgentId
      : (agentsBootstrap.preferredAgentId ?? undefined);
  const validQueryAgentId =
    agentId && agentIds.has(agentId) ? agentId : undefined;
  // Conversation bind may reference an older agent; client swallows 404.
  const resolvedAgentId =
    validQueryAgentId ??
    conversationAgentId ??
    validPreferredAgentId ??
    undefined;
  const initialAssistantIdentity =
    agentsBootstrap.agents.find((agent) => agent.agentId === resolvedAgentId)
      ?.identity ?? null;

  return (
    <ChatClient
      conversationStateKey={`${conversationId ?? 'new'}:${resolvedAgentId ?? ''}`}
      initialConversations={bootstrap.conversations}
      initialConversationId={bootstrap.activeConversationId}
      initialMessages={bootstrap.messages}
      initialChatModels={chatModels}
      initialAgentId={resolvedAgentId}
      initialAssistantIdentity={initialAssistantIdentity}
      initialChatAgents={agentsBootstrap.agents}
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
  const { historyOpen, preferredAgentId } = await readChatPageCookies();

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
          preferredAgentId={preferredAgentId}
          initialHistoryOpen={historyOpen}
        />
      </Suspense>
    </DashboardShell>
  );
}
