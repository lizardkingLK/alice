'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardPenLine,
  Info,
  Kanban,
  Network,
  Plug,
  Settings,
  SlidersHorizontal,
  Timer,
  Users,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { ProjectTeamsPanel } from '@/app/projects/_components/project-details/project-teams-panel';
import { ProjectSummaryBanner } from '@/app/projects/_components/project-details/project-summary-banner';
import { ProjectDetailsTab } from '@/app/projects/_components/project-details/project-details-tab';
import { ProjectMembersTab } from '@/app/projects/_components/project-details/project-members-tab';
import { ProjectIntegrationsTab } from '@/app/projects/_components/project-details/project-integrations-tab';
import { ProjectFieldsWorkspace } from '@/app/projects/_components/project-details/project-fields-workspace';
import { BoardDesignerWorkspace } from '@/app/projects/_components/project-details/board-designer-workspace';
import { ProjectSettingsTab } from '@/app/projects/_components/project-details/project-settings-tab';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';
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
import { isAppRole, isManagerOrAdmin } from '@/lib/rbac/roles';
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
  readonly boardRuleTeams?: Team[];
  readonly initialColumnVisibility?: VisibilityState;
  readonly columnVisibilityHasCookie?: boolean;
}

const MANAGER_ONLY_TABS = new Set<ProjectDetailsTabId>([
  'teams',
  'sprints',
  'fields',
  'board',
  'settings',
]);

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
    managerOrAdminOnly: true,
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
    managerOrAdminOnly: true,
  },
  {
    id: 'board',
    label: 'Board',
    Icon: Kanban,
    managerOrAdminOnly: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    Icon: Settings,
    managerOrAdminOnly: true,
  },
];

function resolveVisibleProjectTab(
  requestedTab: ProjectDetailsTabId,
  canEditProject: boolean
): ProjectDetailsTabId {
  if (!canEditProject && MANAGER_ONLY_TABS.has(requestedTab)) {
    return 'details';
  }
  return requestedTab;
}

export function ProjectDetailsWorkspace({
  project,
  members,
  allUsers,
  currentUserId,
  currentUserRole,
  workItems,
  teams,
  sprints,
  boardRuleTeams = [],
  initialColumnVisibility,
  columnVisibilityHasCookie,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const searchParams = useSearchParams();
  const requestedTab = parseProjectDetailsTab(searchParams.get('tab'));

  const appRole = isAppRole(currentUserRole) ? currentUserRole : null;
  const canEditProject = isManagerOrAdmin(appRole);

  const activeTab = resolveVisibleProjectTab(requestedTab, canEditProject);

  const visibleNavItems = PROJECT_NAV_ITEMS.filter(
    (item) => !item.managerOrAdminOnly || canEditProject
  );

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
                  <Link
                    href={projectDetailHref(project.id, id)}
                    prefetch
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 leading-snug">{label}</span>
                  </Link>
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
              canEditBranding={canEditProject}
            />
            <ProjectDetailsTab
              project={project}
              memberCount={members.length}
              teamCount={teams.totalCount}
              workItemCount={workItems.totalCount}
              sprintCount={sprints.pagination.totalCount}
              integrationCount={countProjectIntegrations(project)}
              fieldCount={countProjectFields(project.attributes_config)}
              isManagerOrAdmin={canEditProject}
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

        {activeTab === 'teams' && canEditProject && (
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

        {activeTab === 'sprints' && canEditProject && (
          <div className="p-6">
            <SprintsWorkspace
              sprints={sprints.sprints}
              pagination={sprints.pagination}
              projects={[project]}
              filterTab={sprints.filterTab}
              projectFilter={project.id}
              search={sprints.search}
              userRole={appRole ?? 'member'}
              currentUserId={currentUserId}
              lockedProjectId={project.id}
            />
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6 p-6">
            <ProjectIntegrationsTab
              project={project}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canEditProject={canEditProject}
            />
          </div>
        )}

        {activeTab === 'fields' && canEditProject && (
          <div className="p-6">
            <ProjectFieldsWorkspace
              project={project}
              isManagerOrAdmin={canEditProject}
            />
          </div>
        )}

        {activeTab === 'board' && canEditProject && (
          <div className="p-6">
            <BoardDesignerWorkspace
              project={project}
              canEdit={canEditProject}
              currentUserId={currentUserId}
              teams={boardRuleTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              members={members
                .filter((member) => member.user !== null)
                .map((member) => ({
                  userId: member.user_id,
                  name: member.user?.name ?? member.user_id,
                  email: member.user?.email,
                  role: member.user?.role,
                }))}
            />
          </div>
        )}

        {activeTab === 'settings' && canEditProject && (
          <div className="p-6">
            <ProjectSettingsTab
              project={project}
              isManagerOrAdmin={canEditProject}
            />
          </div>
        )}
      </main>
    </div>
  );
}
