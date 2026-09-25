'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Badge } from '@repo/ui/components/ui/badge';
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Archive, UserRound, Users } from '@repo/ui/lib/icons';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { SearchInput } from '@/components/search-input';
import {
  parseChatAgentsGalleryTab,
  type ViewsListTab,
} from '@/lib/search-params';
import {
  listArchivedGalleryAgents,
  listMineGalleryAgents,
  listSharedGalleryAgents,
  subscribeChatAgentsCatalog,
  type ChatAgentRecord,
} from '@/app/chat/_helpers/chat-agents-catalog';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';

const GALLERY_TABS: ReadonlyArray<{
  id: ViewsListTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: 'mine', label: 'Mine', icon: UserRound },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'archived', label: 'Archived', icon: Archive },
];

function emptyGalleryMessage(tab: ViewsListTab, hasSearch: boolean): string {
  if (hasSearch) {
    return 'No agents match your search.';
  }
  if (tab === 'shared') {
    return 'No agents have been shared with you yet.';
  }
  if (tab === 'archived') {
    return 'No archived agents.';
  }
  return 'No agents yet.';
}

function agentMatchesSearch(agent: ChatAgentRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [
    agent.name,
    agent.title,
    agent.tagline,
    agent.description,
    agent.authorName,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

type AgentGalleryCardProps = {
  readonly agent: ChatAgentRecord;
  // eslint-disable-next-line no-unused-vars
  readonly onSelect: (agentId: string) => void;
};

function AgentGalleryCard({
  agent,
  onSelect,
}: Readonly<AgentGalleryCardProps>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.id)}
      className="focus-visible:ring-ring block w-full cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="border-border hover:border-primary/40 h-full border shadow-none ring-0 transition-colors">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
          <ChatAgentAvatar
            name={agent.name}
            kind={agent.kind}
            avatarStyle={agent.avatarStyle}
            avatarSeed={agent.avatarSeed}
            size="xl"
            className="shadow-sm ring-1 ring-black/5"
          />
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <TruncatedText className="text-sm font-semibold">
                {agent.name}
              </TruncatedText>
              {agent.kind === 'system' ? (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  System
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase">
                  v{agent.version}
                </Badge>
              )}
              {agent.status === 'archived' ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  Archived
                </Badge>
              ) : null}
            </div>
            {agent.title.trim() ? (
              <TruncatedText className="text-muted-foreground text-xs">
                {agent.title}
              </TruncatedText>
            ) : null}
            <TruncatedText className="text-muted-foreground text-xs">
              {agent.tagline}
            </TruncatedText>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {agent.description}
          </p>
          <p className="text-muted-foreground text-xs">by {agent.authorName}</p>
        </CardContent>
      </Card>
    </button>
  );
}

type ChatAgentsGalleryProps = {
  // eslint-disable-next-line no-unused-vars
  readonly onSelectAgent: (agentId: string) => void;
  readonly initialTab?: ViewsListTab;
};

export function ChatAgentsGallery({
  onSelectAgent,
  initialTab = 'mine',
}: Readonly<ChatAgentsGalleryProps>) {
  const [activeTab, setActiveTab] = useState<ViewsListTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    return subscribeChatAgentsCatalog(() => {
      setCatalogTick((tick) => tick + 1);
    });
  }, []);

  const agentsByTab = useMemo(
    () => ({
      mine: listMineGalleryAgents(),
      shared: listSharedGalleryAgents(),
      archived: listArchivedGalleryAgents(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- catalogTick refreshes lists
    [catalogTick]
  );

  const filteredAgentsByTab = useMemo(
    () => ({
      mine: agentsByTab.mine.filter((agent) =>
        agentMatchesSearch(agent, searchQuery)
      ),
      shared: agentsByTab.shared.filter((agent) =>
        agentMatchesSearch(agent, searchQuery)
      ),
      archived: agentsByTab.archived.filter((agent) =>
        agentMatchesSearch(agent, searchQuery)
      ),
    }),
    [agentsByTab, searchQuery]
  );

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Agents</h2>
          <p className="text-muted-foreground text-sm">
            Open a card to customize. Use Chat on the agent to start a
            conversation.
          </p>
        </div>
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search agents..."
          className="w-full max-w-sm shrink-0 sm:mt-0.5"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(parseChatAgentsGalleryTab(value))
        }
        className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6"
      >
        <TabsList className="border-border flex h-auto shrink-0 justify-start gap-4 rounded-none border-b bg-transparent p-0">
          {GALLERY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={UNDERLINE_TAB_TRIGGER_CLASS}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GALLERY_TABS.map((tab) => {
          const agents = filteredAgentsByTab[tab.id];
          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="m-0 flex min-h-0 flex-1 flex-col focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              {agents.length === 0 ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 py-12 text-center text-sm">
                  {emptyGalleryMessage(tab.id, hasSearch)}
                </div>
              ) : (
                <div className="no-scrollbar grid grid-cols-1 gap-4 overflow-y-auto pb-6 sm:grid-cols-2 xl:grid-cols-3">
                  {agents.map((agent) => (
                    <AgentGalleryCard
                      key={agent.id}
                      agent={agent}
                      onSelect={onSelectAgent}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
