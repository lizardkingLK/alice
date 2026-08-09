import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { User as DbUser } from '@/app/users/_services/users.service';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { WorkItemListView } from '@/lib/search-params';

export interface WorkItemWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  sprints: Sprint[];
  initialWorkItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  search: string;
  projectFilter: string;
  sprintFilter: string;
  typeFilter: string;
  assigneeFilter: string;
  /** Exact labels currently applied (from URL). */
  labelsFilter?: readonly string[];
  /** Flat (default) or hierarchy (roots + expand). */
  listView?: WorkItemListView;
  /** When set, list is scoped to this project and create/edit locks project. */
  lockedProjectId?: string;
  /** When set, list is scoped to this assignee and create locks assignee. */
  lockedAssigneeId?: string;
  currentUserId?: string | null;
  suggestedDefaults?: BoardDefaultsPreference | null;
  needsClientBootstrap?: boolean;
}

export default function WorkItemsWorkspace(
  props: Readonly<WorkItemWorkspaceProps>
) {
  return (
    <div className="w-full">
      <WorkItemsTable {...props} />
    </div>
  );
}
