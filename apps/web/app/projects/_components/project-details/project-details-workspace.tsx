'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardPenLine,
  Info,
  Network,
  Plug,
  SlidersHorizontal,
  Users,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
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

const PROJECT_NAV_ITEMS: ReadonlyArray<{
  readonly id: ProjectDetailsTabId;
  readonly label: string;
  readonly Icon: typeof Info;
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
  initialColumnVisibility,
  columnVisibilityHasCookie,
}: Readonly<ProjectDetailsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseProjectDetailsTab(searchParams.get('tab'));

  const isManagerOrAdmin =
    currentUserRole === 'admin' || currentUserRole === 'manager';

  const handleTabChange = (nextTab: ProjectDetailsTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'details') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="border-border shrink-0 border-b md:flex md:h-full md:w-56 md:flex-col md:border-r md:border-b-0">
        <div className="px-4 py-4 sm:px-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </span>
          <p
            className="truncate text-sm font-semibold text-foreground mt-0.5"
            title={project.name}
          >
            {project.name}
          </p>
        </div>
        <nav
          aria-label="Project sections"
          className="px-2 pb-3 md:pb-6 overflow-x-auto md:overflow-x-visible"
        >
          <ul className="flex flex-row md:flex-col gap-0.5">
            {PROJECT_NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <li key={id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTabChange(id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors w-full text-left cursor-pointer whitespace-nowrap',
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
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="p-6 space-y-6">
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
