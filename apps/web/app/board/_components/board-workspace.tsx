'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Calendar, Kanban } from '@repo/ui/lib/icons';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { KanbanBoard } from '@/app/board/_components/kanban-board';
import { CalendarRegistry } from '@/app/calendar/_components/calendar-registry';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { User } from '@/app/users/_services/users.service';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { parseBoardPageTab, type BoardPageTab } from '@/lib/search-params';

type BoardWorkspaceProps = {
  readonly initialWorkItems: DbWorkItem[];
  readonly projects: Project[];
  readonly sprints: Sprint[];
  readonly users: User[];
  readonly projectFilter: string;
  readonly sprintFilter: string;
  readonly allowAllFilters: boolean;
  readonly userId: string | null;
  readonly suggestedDefaults: {
    readonly projectId: string;
    readonly sprintId: string | null;
  } | null;
  readonly needsClientBootstrap: boolean;
};

export function BoardWorkspace({
  initialWorkItems,
  projects,
  sprints,
  users,
  projectFilter,
  sprintFilter,
  allowAllFilters,
  userId,
  suggestedDefaults,
  needsClientBootstrap,
}: Readonly<BoardWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab: BoardPageTab = parseBoardPageTab(searchParams.get('tab'));

  const handleTabChange = (value: string) => {
    const nextTab = parseBoardPageTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'board') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full min-h-0 w-full flex-1 flex-col gap-6"
    >
      <TabsList className="border-border flex h-auto shrink-0 justify-start gap-4 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="board" className={UNDERLINE_TAB_TRIGGER_CLASS}>
          <Kanban className="h-4 w-4" />
          Board
        </TabsTrigger>
        <TabsTrigger value="calendar" className={UNDERLINE_TAB_TRIGGER_CLASS}>
          <Calendar className="h-4 w-4" />
          Calendar
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="board"
        className="m-0 flex min-h-0 flex-1 flex-col focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <KanbanBoard
          initialWorkItems={initialWorkItems}
          projects={projects}
          sprints={sprints}
          projectFilter={projectFilter}
          sprintFilter={sprintFilter}
          allowAllFilters={allowAllFilters}
          userId={userId}
          suggestedDefaults={suggestedDefaults}
          needsClientBootstrap={needsClientBootstrap}
        />
      </TabsContent>

      <TabsContent
        value="calendar"
        className="m-0 flex min-h-0 flex-1 flex-col focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <CalendarRegistry
          projects={projects}
          sprints={sprints}
          workItems={initialWorkItems}
          users={users}
          projectFilter={projectFilter}
          sprintFilter={sprintFilter}
          allowAllFilters={allowAllFilters}
          userId={userId}
          suggestedDefaults={suggestedDefaults}
          needsClientBootstrap={needsClientBootstrap}
        />
      </TabsContent>
    </Tabs>
  );
}
