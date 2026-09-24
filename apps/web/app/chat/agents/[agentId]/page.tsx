import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ChatAgentCustomizeSkeleton } from '@/app/chat/_components/chat-agent-customize-skeleton';
import { ChatAgentCustomizePage } from '@/app/chat/_components/chat-agent-customize-page';
import { getDbUser } from '@/lib/auth';
import { isAdmin } from '@/lib/rbac';

export const metadata: Metadata = {
  title: 'Customize agent',
  robots: { index: false, follow: false },
};

async function ChatAgentCustomizeData({
  agentId,
}: Readonly<{ agentId: string }>) {
  const dbUser = await getDbUser();
  return (
    <ChatAgentCustomizePage
      agentId={agentId}
      canManageSystemAgents={isAdmin(dbUser?.role)}
      currentUserName={dbUser?.name ?? null}
      currentUserEmail={dbUser?.email ?? null}
    />
  );
}

export default async function ChatAgentCustomizeRoute({
  params,
}: Readonly<{
  params: Promise<{ agentId: string }>;
}>) {
  const { agentId } = await params;

  return (
    <DashboardShell
      description="Customize an Alice agent, fork a new version, or start a chat."
      stickyHeader
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <Suspense fallback={<ChatAgentCustomizeSkeleton />}>
        <ChatAgentCustomizeData agentId={decodeURIComponent(agentId)} />
      </Suspense>
    </DashboardShell>
  );
}
