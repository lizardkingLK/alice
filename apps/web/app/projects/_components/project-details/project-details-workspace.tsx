'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardPenLine,
  Info,
  Network,
  Plug,
  SlidersHorizontal,
  Timer,
  Users,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { UserRoleEnum } from '@repo/types';
import { ProjectTeamsPanel } from '@/app/projects/_components/project-details/project-teams-panel';
import { ProjectSummaryBanner } from '@/app/projects/_components/project-details/project-summary-banner';
import { ProjectDetailsTab } from '@/app/projects/_components/project-details/project-details-tab';
import { ProjectMembersTab } from '@/app/projects/_components/project-details/project-members-tab';
import { ProjectIntegrationsTab } from '@/app/projects/_components/project-details/project-integrations-tab';
import { ProjectFieldsWorkspace } from '@/app/projects/_components/project-details/project-fields-workspace';
import type {
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.client';
import type { Team } from '@/app/manager/_services/teams.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import WorkItemsWorkspace from '@/app/work-items/_components/work-items-workspace';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import {
  countProjectFields,
  countProjectIntegrations,
} from '@/app/projects/_helpers/project-summary-counts';
import {
  parseProjectDetailsTab,
  type ProjectDetailsTab as ProjectDetailsTabId,
} from '@/lib/search-params';
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
  readonly sprintFilter: string;
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

interface ProjectSprintsProps {
  readonly sprints: Sprint[];
  readonly pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  readonly filterTab: 'active' | 'archived';
  readonly search: string;
}

interface ProjectDetailsWorkspaceProps {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly allUsers: User[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly workItems: ProjectWorkItemsProps;
  readonly teams: ProjectTeamsProps;
  readonly sprints: ProjectSprintsProps;
  readonly initialColumnVisibility?: VisibilityState;
  readonly columnVisibilityHasCookie?: boolean;
}

const PROJECT_NAV_ITEMS: ReadonlyArray<{
  readonly id: ProjectDetailsTabId;
  readonly label: string;
  readonly Icon: typeof Info;
  readonly managerOrAdminOnly?: boolean;
}> = [
  {
    id: 'details',
    label: 'Details',
    Icon: Info,
  },
  {
    id: 'members',
    label: 'Members',
    Icon: Users,
  },
  {
    id: 'teams',
    label: 'Teams',
    Icon: Network,
  },
  {
    id: 'work-items',
    label: 'Work Items',
    Icon: ClipboardPenLine,
  },
  {
    id: 'sprints',
    label: 'Sprints',
    Icon: Timer,
    managerOrAdminOnly: true,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    Icon: Plug,
  },
  {
    id: 'fields',
    label: 'Fields',
    Icon: SlidersHorizontal,
  },
];

export function ProjectDetailsWorkspace({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
  workItems,
  teams,
  sprints,
  initialColumnVisibility,
  columnVisibilityHasCookie,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = parseProjectDetailsTab(searchParams.get('tab'));

  const isManagerOrAdmin =
    currentUserRole === UserRoleEnum.admin ||
    currentUserRole === UserRoleEnum.manager;

  const activeTab =
    requestedTab === 'sprints' && !isManagerOrAdmin ? 'details' : requestedTab;

  const visibleNavItems = PROJECT_NAV_ITEMS.filter(
    (item) => !item.managerOrAdminOnly || isManagerOrAdmin
  );

  const handleTabChange = (nextTab: ProjectDetailsTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'details') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    if (nextTab !== 'sprints') {
      params.delete('sprintStatus');
    }
    if (nextTab !== 'work-items') {
      params.delete('recordStatus');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="border-border shrink-0 border-b md:flex md:h-full md:w-56 md:flex-col md:border-r md:border-b-0">
        <div className="px-4 py-4 sm:px-5">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Project
          </span>
          <p
            className="text-foreground mt-0.5 truncate text-sm font-semibold"
            title={project.name}
          >
            {project.name}
          </p>
        </div>
        <nav
          aria-label="Project sections"
          className="overflow-x-auto px-2 pb-3 md:overflow-x-visible md:pb-6"
        >
          <ul className="flex flex-row gap-0.5 md:flex-col">
            {visibleNavItems.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <li key={id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTabChange(id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 leading-snug">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {activeTab === 'details' && (
          <div className="space-y-6 p-6">
            <ProjectSummaryBanner
              project={project}
              canEditBranding={isManagerOrAdmin}
            />
            <ProjectDetailsTab
              project={project}
              memberCount={members.length}
              teamCount={teams.totalCount}
              workItemCount={workItems.totalCount}
              sprintCount={sprints.pagination.totalCount}
              integrationCount={countProjectIntegrations(project)}
              fieldCount={countProjectFields(project.attributes_config)}
              isManagerOrAdmin={isManagerOrAdmin}
            />
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-6">
            <ProjectMembersTab
              project={project}
              members={members}
              allUsers={allUsers}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="p-6">
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
          </div>
        )}

        {activeTab === 'work-items' && (
          <div className="p-6">
            <WorkItemsWorkspace
              projects={[project]}
              projectMembers={members
                .map((member) => member.user)
                .filter((user): user is NonNullable<typeof user> =>
                  Boolean(user)
                )
                .map((user) => ({
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  profile_picture: user.profile_picture ?? null,
                }))}
              projectMembersByProjectId={{ [project.id]: members }}
              sprints={sprints.sprints}
              initialWorkItems={workItems.initialWorkItems}
              totalCount={workItems.totalCount}
              page={workItems.page}
              limit={workItems.limit}
              totalPages={workItems.totalPages}
              search={workItems.search}
              projectFilter={project.id}
              sprintFilter={workItems.sprintFilter}
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
          </div>
        )}

        {activeTab === 'sprints' && isManagerOrAdmin && (
          <div className="p-6">
            <SprintsWorkspace
              sprints={sprints.sprints}
              pagination={sprints.pagination}
              projects={[project]}
              filterTab={sprints.filterTab}
              projectFilter={project.id}
              search={sprints.search}
              userRole={currentUserRole ?? UserRoleEnum.member}
              currentUserId={currentUserId}
              lockedProjectId={project.id}
            />
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6 p-6">
            <ProjectIntegrationsTab project={project} />
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="p-6">
            <ProjectFieldsWorkspace
              project={project}
              isManagerOrAdmin={isManagerOrAdmin}
            />
          </div>
        )}
      </main>
    </div>
  );
}
