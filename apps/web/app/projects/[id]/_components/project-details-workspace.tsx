'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@repo/ui/components/ui/tabs';
import {
  ClipboardPenLine,
  Info,
  Network,
  Plug,
  Users,
} from '@repo/ui/lib/icons';
import { ProjectTeamsPanel } from '@/app/projects/[id]/_components/project-teams-panel';
import { ProjectSummaryBanner } from '@/app/projects/[id]/_components/project-summary-banner';
import { ProjectDetailsTab } from '@/app/projects/[id]/_components/project-details-tab';
import { ProjectMembersTab } from '@/app/projects/[id]/_components/project-members-tab';
import { ProjectIntegrationsTab } from '@/app/projects/[id]/_components/project-integrations-tab';
import type {
  Project,
  ProjectMemberWithUser,
} from '../../_services/projects.service';
import type { Team } from '@/app/manager/_services/teams.service';
import type { User } from '@/app/users/_services/users.service';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  parseProjectDetailsTab,
  type ProjectDetailsTab as ProjectDetailsTabId,
} from '@/lib/search-params';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import type { VisibilityState } from '@tanstack/react-table';

interface ProjectWorkItemsProps {
  readonly initialWorkItems: DbWorkItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly typeFilter: string;
  readonly assigneeFilter: string;
  readonly labelsFilter?: readonly string[];
  readonly listView: 'flat' | 'hierarchy';
  readonly tab: 'active' | 'archived';
}

interface ProjectTeamsProps {
  readonly items: Team[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly status: 'active' | 'inactive' | 'archived';
}

interface ProjectDetailsWorkspaceProps {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly workItems: ProjectWorkItemsProps;
  readonly teams: ProjectTeamsProps;
  readonly initialColumnVisibility?: VisibilityState;
  readonly columnVisibilityHasCookie?: boolean;
}

const TAB_CONTENT_CLASS =
  'm-0 focus-visible:ring-0 focus-visible:ring-offset-0';

export function ProjectDetailsWorkspace({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
  workItems,
  teams,
  initialColumnVisibility,
  columnVisibilityHasCookie,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseProjectDetailsTab(searchParams.get('tab'));

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';

  const handleTabChange = (value: string) => {
    const nextTab = value as ProjectDetailsTabId;
    const params = new URLSearchParams();
    if (nextTab !== 'details') {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="space-y-6">
      <ProjectSummaryBanner
        project={project}
        canEditBranding={isManagerOrAdmin}
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-6"
      >
        <TabsList className="border-border flex h-auto justify-start gap-4 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="details" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Info className="h-4 w-4" />
            Project Details
          </TabsTrigger>
          <TabsTrigger value="members" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="teams" className={UNDERLINE_TAB_TRIGGER_CLASS}>
            <Network className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="work-items"
            className={UNDERLINE_TAB_TRIGGER_CLASS}
          >
            <ClipboardPenLine className="h-4 w-4" />
            Work Items
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className={UNDERLINE_TAB_TRIGGER_CLASS}
          >
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="details"
          className={`${TAB_CONTENT_CLASS} space-y-6`}
        >
          <ProjectDetailsTab
            project={project}
            memberCount={members.length}
            teamCount={teams.totalCount}
            workItemCount={workItems.totalCount}
          />
        </TabsContent>

        <TabsContent
          value="integrations"
          className={`${TAB_CONTENT_CLASS} space-y-6`}
        >
          <ProjectIntegrationsTab project={project} />
        </TabsContent>

        <TabsContent value="members" className={TAB_CONTENT_CLASS}>
          <ProjectMembersTab
            project={project}
            members={members}
            allUsers={allUsers}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        </TabsContent>

        <TabsContent value="teams" className={TAB_CONTENT_CLASS}>
          <ProjectTeamsPanel
            project={project}
            members={members}
            teams={teams.items}
            totalCount={teams.totalCount}
            page={teams.page}
            limit={teams.limit}
            totalPages={teams.totalPages}
            tab={teams.status}
            search={teams.search}
            users={allUsers}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        </TabsContent>

        <TabsContent value="work-items" className={TAB_CONTENT_CLASS}>
          <WorkItemsWorkspace
            projects={[project]}
            projectMembers={allUsers}
            sprints={[]}
            initialWorkItems={workItems.initialWorkItems}
            totalCount={workItems.totalCount}
            page={workItems.page}
            limit={workItems.limit}
            totalPages={workItems.totalPages}
            search={workItems.search}
            projectFilter={project.id}
            sprintFilter=""
            typeFilter={workItems.typeFilter}
            assigneeFilter={workItems.assigneeFilter}
            labelsFilter={workItems.labelsFilter ?? []}
            listView={workItems.listView}
            tab={workItems.tab}
            lockedProjectId={project.id}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole ?? undefined}
            initialColumnVisibility={initialColumnVisibility}
            columnVisibilityHasCookie={columnVisibilityHasCookie}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
