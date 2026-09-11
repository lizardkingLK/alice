import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { formatDate } from '@/app/_shared/utility';
import {
  mapPriorityToBacklogPriority,
  type BacklogPriority,
} from '@/app/work-items/_helpers/work-item-priority-ui';
import type { WorkItemPriority } from '@repo/types';

export type BacklogActiveTab = 'active' | 'completed';

export type BacklogAssignee = {
  id: string;
  name: string;
  email: string;
  profile_picture?: string | null;
};

export function mapPriority(priority: WorkItemPriority): BacklogPriority {
  return mapPriorityToBacklogPriority(priority);
}

export function formatDateRange(
  start: string | null | Date,
  end: string | null | Date
): string {
  if (!start || !end) return 'No dates set';
  const startValue = start instanceof Date ? start.toISOString() : start;
  const endValue = end instanceof Date ? end.toISOString() : end;
  return `${formatDate(startValue)} - ${formatDate(endValue)}`;
}

export function projectDisplayKey(
  projectKey: string | undefined,
  itemId: string
): string {
  return `${projectKey || 'ALICE'}-${itemId.slice(0, 4).toUpperCase()}`;
}

/**
 * Prefer the work-item assignee embed, then fall back to the workspace member
 * list so backlog rows still get profile pictures when the embed is thin.
 */
export function resolveBacklogAssigneeAvatar(
  item: Pick<DbWorkItem, 'assignee_id' | 'assignee'>,
  membersById: ReadonlyMap<string, BacklogAssignee>
): string | null {
  const fromItem = item.assignee?.profile_picture?.trim();
  if (fromItem) {
    return fromItem;
  }
  if (!item.assignee_id) {
    return null;
  }
  return membersById.get(item.assignee_id)?.profile_picture?.trim() || null;
}

export function enrichWorkItemsWithMemberAvatars(
  items: readonly DbWorkItem[],
  members: readonly BacklogAssignee[]
): DbWorkItem[] {
  const membersById = new Map(members.map((member) => [member.id, member]));

  return items.map((item) => {
    if (!item.assignee_id) {
      return item;
    }

    const member = membersById.get(item.assignee_id);
    if (!member && !item.assignee) {
      return item;
    }

    const profilePicture = resolveBacklogAssigneeAvatar(item, membersById);

    if (
      item.assignee?.profile_picture === profilePicture &&
      (!member || item.assignee?.name === member.name)
    ) {
      return item;
    }

    return {
      ...item,
      assignee: {
        id: item.assignee?.id ?? member?.id ?? item.assignee_id,
        name: item.assignee?.name ?? member?.name ?? 'Unknown',
        email: item.assignee?.email ?? member?.email ?? '',
        profile_picture: profilePicture,
      },
    };
  });
}

export function getFormDataStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '';
}

export function updateWorkItemField<K extends keyof DbWorkItem>(
  item: DbWorkItem,
  itemId: string,
  field: K,
  value: DbWorkItem[K],
  updatedAssignee: BacklogAssignee | null
): DbWorkItem {
  if (item.id === itemId) {
    const updated = { ...item, [field]: value };
    if (field === 'assignee_id') {
      updated.assignee = updatedAssignee;
    }
    return updated;
  }
  return item;
}

type FilterBacklogDisplayedSprintsOptions<T extends { readonly id: string }> = {
  readonly sprints: readonly T[];
  readonly activeTab: BacklogActiveTab;
  readonly projectFilter: string;
  /** Empty string means all sprints for the project (or all projects). */
  readonly sprintFilter: string;
  // eslint-disable-next-line no-unused-vars
  readonly getStatus: (sprint: T) => string;
  // eslint-disable-next-line no-unused-vars
  readonly getProjectId: (sprint: T) => string | null | undefined;
};

/** Active/completed tab + project + optional default sprint narrowing. */
export function filterBacklogDisplayedSprints<
  T extends { readonly id: string },
>(options: FilterBacklogDisplayedSprintsOptions<T>): T[] {
  const {
    sprints,
    activeTab,
    projectFilter,
    sprintFilter,
    getStatus,
    getProjectId,
  } = options;

  const byTab =
    activeTab === 'completed'
      ? sprints.filter((sprint) => getStatus(sprint) === 'closed')
      : sprints.filter((sprint) => {
          const status = getStatus(sprint);
          return status === 'active' || status === 'planned';
        });

  const byProject =
    projectFilter === 'all'
      ? byTab
      : byTab.filter((sprint) => getProjectId(sprint) === projectFilter);

  if (!sprintFilter) {
    return byProject;
  }

  return byProject.filter((sprint) => sprint.id === sprintFilter);
}
