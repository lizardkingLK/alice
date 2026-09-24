'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Bot, MessageSquare } from '@repo/ui/lib/icons';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { parseChatPageTab, type ChatPageTab } from '@/lib/search-params';
import { ChatAgentsGallery } from '@/app/chat/_components/chat-agents-gallery';

type ChatWorkspaceProps = {
  readonly conversation: ReactNode;
};

export function ChatWorkspace({ conversation }: Readonly<ChatWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab: ChatPageTab = parseChatPageTab(searchParams.get('tab'));

  const handleTabChange = (value: string) => {
    const nextTab = parseChatPageTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'conversation') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
      params.delete('agentId');
      params.delete('agentsTab');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden"
    >
      <div className="border-border shrink-0 border-b px-4 pt-3 sm:px-6">
        <TabsList className="flex h-auto justify-start gap-4 rounded-none bg-transparent p-0">
          <TabsTrigger
            value="conversation"
            className={UNDERLINE_TAB_TRIGGER_CLASS}
          >
            <MessageSquare className="size-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="agents" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Bot className="size-4" />
            Agents
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="conversation"
        className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {conversation}
      </TabsContent>

      <TabsContent
        value="agents"
        className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <ChatAgentsGallery />
      </TabsContent>
    </Tabs>
  );
}
