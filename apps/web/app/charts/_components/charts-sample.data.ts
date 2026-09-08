import type { ChartConfig } from '@repo/ui/components/ui/chart';
import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@repo/types';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import { PRIORITY_LABELS } from '@/app/work-items/_helpers/work-item-priority-ui';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';

export type ChartsSampleMember = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profilePicture: string | null;
};

export type ChartsSampleProject = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
};

export type ChartsSampleWorkItem = {
  readonly id: string;
  readonly title: string;
  readonly status: WorkItemStatus;
  readonly type: WorkItemType;
  readonly priority: WorkItemPriority;
  readonly assigneeId: string | null;
  readonly projectId: string;
};

/** Sample project the signed-in user would be a member of. */
export const CHARTS_SAMPLE_PROJECTS: readonly ChartsSampleProject[] = [
  {
    id: 'proj-alice',
    key: 'ALICE',
    name: 'Alice Platform',
  },
  {
    id: 'proj-demo',
    key: 'DEMO',
    name: 'Demo Delivery',
  },
] as const;

export const CHARTS_SAMPLE_MEMBERS: readonly ChartsSampleMember[] = [
  {
    id: 'user-alice',
    name: 'Alice Admin',
    email: 'admin@alice.dev',
    profilePicture: null,
  },
  {
    id: 'user-bob',
    name: 'Bob Member',
    email: 'bob@alice.dev',
    profilePicture: null,
  },
  {
    id: 'user-cara',
    name: 'Cara Manager',
    email: 'cara@alice.dev',
    profilePicture: null,
  },
  {
    id: 'user-dan',
    name: 'Dan Designer',
    email: 'dan@alice.dev',
    profilePicture: null,
  },
  {
    id: 'user-eve',
    name: 'Eve Engineer',
    email: 'eve@alice.dev',
    profilePicture: null,
  },
] as const;

export const CHARTS_SAMPLE_WORK_ITEMS: readonly ChartsSampleWorkItem[] = [
  {
    id: 'wi-1',
    title: 'Database Setup and Prisma Migration',
    status: 'Done',
    type: 'Task',
    priority: 'highest',
    assigneeId: 'user-alice',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-2',
    title: 'Implement Core User Model',
    status: 'Done',
    type: 'Story',
    priority: 'highest',
    assigneeId: 'user-bob',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-3',
    title: 'Projects & Memberships',
    status: 'InProgress',
    type: 'Story',
    priority: 'high',
    assigneeId: 'user-cara',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-4',
    title: 'Teams and Reporting Lines',
    status: 'InProgress',
    type: 'Story',
    priority: 'medium',
    assigneeId: 'user-dan',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-5',
    title: 'Sprints Engine',
    status: 'Testing',
    type: 'Story',
    priority: 'high',
    assigneeId: 'user-eve',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-6',
    title: 'Work Items Hierarchy',
    status: 'ToDo',
    type: 'Epic',
    priority: 'highest',
    assigneeId: 'user-alice',
    projectId: 'proj-alice',
  },
  {
    id: 'wi-7',
    title: 'Comments and Attachments',
    status: 'New',
    type: 'Story',
    priority: 'high',
    assigneeId: 'user-bob',
    projectId: 'proj-demo',
  },
  {
    id: 'wi-8',
    title: 'Access Allowlist',
    status: 'InProgress',
    type: 'Story',
    priority: 'medium',
    assigneeId: 'user-cara',
    projectId: 'proj-demo',
  },
  {
    id: 'wi-9',
    title: 'Jira OAuth Sync',
    status: 'ToDo',
    type: 'Story',
    priority: 'high',
    assigneeId: null,
    projectId: 'proj-demo',
  },
] as const;

export type ChartsStatusPieSlice = {
  readonly status: string;
  readonly label: string;
  readonly count: number;
  readonly percent: string;
  readonly fill: string;
  readonly swatch: string;
};

const FALLBACK_STATUS_COLOR = 'oklch(0.55 0.02 264)';

export function buildChartsStatusPieFromSample(
  items: readonly ChartsSampleWorkItem[] = CHARTS_SAMPLE_WORK_ITEMS
): {
  readonly data: ChartsStatusPieSlice[];
  readonly config: ChartConfig;
  readonly total: number;
} {
  const counts = new Map<WorkItemStatus, number>();
  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }

  const statusesWithCounts = BOARD_WORK_ITEM_STATUSES.filter(
    (status) => (counts.get(status) ?? 0) > 0
  );

  const total = items.length;
  const data: ChartsStatusPieSlice[] = statusesWithCounts.map((status) => {
    const count = counts.get(status) ?? 0;
    const meta = STATUS_META[status];
    const swatch = meta?.color ?? FALLBACK_STATUS_COLOR;
    const percent =
      total === 0 ? '0%' : `${((count / total) * 100).toFixed(1)}%`;
    return {
      status,
      label: meta?.label ?? status,
      count,
      percent,
      fill: `var(--color-${status})`,
      swatch,
    };
  });

  const config: ChartConfig = {
    count: { label: 'Tasks' },
  };
  for (const slice of data) {
    config[slice.status] = {
      label: slice.label,
      color: slice.swatch,
    };
  }

  return { data, config, total };
}

export type ChartsFilterColumnId = 'status' | 'type' | 'assignee' | 'priority';

export const CHARTS_FILTER_COLUMNS: readonly {
  readonly id: ChartsFilterColumnId;
  readonly label: string;
}[] = [
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Type' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
] as const;

export type ChartsFilterOption = {
  readonly value: string;
  readonly label: string;
};

export function chartsFilterValueOptions(
  column: ChartsFilterColumnId
): readonly ChartsFilterOption[] {
  switch (column) {
    case 'status':
      return BOARD_WORK_ITEM_STATUSES.map((status) => ({
        value: status,
        label: STATUS_META[status]?.label ?? status,
      }));
    case 'type':
      return WORK_ITEM_TYPES.map((type) => ({
        value: type,
        label: type,
      }));
    case 'assignee':
      return [
        { value: 'unassigned', label: 'Unassigned' },
        ...CHARTS_SAMPLE_MEMBERS.map((member) => ({
          value: member.id,
          label: member.name,
        })),
      ];
    case 'priority':
      return WORK_ITEM_PRIORITIES.map((priority) => ({
        value: priority,
        label: PRIORITY_LABELS[priority],
      }));
    default:
      return [];
  }
}

export const CHARTS_EXPORT_FORMATS = [
  { id: 'png', label: 'PNG image' },
  { id: 'svg', label: 'SVG vector' },
  { id: 'csv', label: 'CSV data' },
  { id: 'pdf', label: 'PDF document' },
] as const;

export type ChartsExportFormatId = (typeof CHARTS_EXPORT_FORMATS)[number]['id'];

export type ChartsFilterCondition = 'is' | 'is-not' | 'contains';

export type ChartsAdvancedFilterRow = {
  readonly id: string;
  readonly column: ChartsFilterColumnId;
  readonly condition: ChartsFilterCondition;
  readonly value: string;
};

export type ChartsQuickFieldId =
  | 'project'
  | 'status'
  | 'type'
  | 'assignee'
  | 'priority';

const QUICK_FIELD_ALL_LABELS: Record<
  Exclude<ChartsQuickFieldId, 'project' | 'assignee'>,
  string
> = {
  status: 'All statuses',
  type: 'All types',
  priority: 'All priorities',
};

/** Quick-filter option lists (includes an “all” sentinel). */
export function chartsQuickFieldOptions(
  field: ChartsQuickFieldId
): readonly ChartsFilterOption[] {
  if (field === 'project') {
    return [
      { value: 'all', label: 'All projects' },
      ...CHARTS_SAMPLE_PROJECTS.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ];
  }
  if (field === 'assignee') {
    return [
      { value: 'all', label: 'Anyone' },
      ...chartsFilterValueOptions('assignee'),
    ];
  }
  return [
    { value: 'all', label: QUICK_FIELD_ALL_LABELS[field] },
    ...chartsFilterValueOptions(field),
  ];
}

export type ChartsWidgetFilterDraft = {
  readonly mode: 'advanced' | 'quick';
  readonly projectId: string;
  readonly rows: readonly ChartsAdvancedFilterRow[];
  readonly quickSelections: Readonly<Record<ChartsQuickFieldId, string>>;
};

function fieldValueForColumn(
  item: ChartsSampleWorkItem,
  column: ChartsFilterColumnId
): string {
  switch (column) {
    case 'status':
      return item.status;
    case 'type':
      return item.type;
    case 'assignee':
      return item.assigneeId ?? 'unassigned';
    case 'priority':
      return item.priority;
    default:
      return '';
  }
}

function matchesCondition(
  actual: string,
  condition: ChartsFilterCondition,
  expected: string
): boolean {
  const actualLower = actual.toLowerCase();
  const expectedLower = expected.toLowerCase();
  if (condition === 'is') {
    return actualLower === expectedLower;
  }
  if (condition === 'is-not') {
    return actualLower !== expectedLower;
  }
  return actualLower.includes(expectedLower);
}

function matchesAdvancedRow(
  item: ChartsSampleWorkItem,
  row: ChartsAdvancedFilterRow
): boolean {
  if (!row.value) {
    return true;
  }
  return matchesCondition(
    fieldValueForColumn(item, row.column),
    row.condition,
    row.value
  );
}

function matchesQuickSelection(
  item: ChartsSampleWorkItem,
  field: ChartsQuickFieldId,
  value: string
): boolean {
  if (!value || value === 'all') {
    return true;
  }
  if (field === 'project') {
    return item.projectId === value;
  }
  return fieldValueForColumn(item, field) === value;
}

export function filterChartsSampleWorkItems(
  items: readonly ChartsSampleWorkItem[],
  filters: ChartsWidgetFilterDraft | null,
  options?: {
    readonly search?: string;
    readonly assigneeId?: string | null;
  }
): ChartsSampleWorkItem[] {
  const search = options?.search?.trim().toLowerCase() ?? '';
  const toolbarAssignee = options?.assigneeId ?? null;

  return items.filter((item) => {
    if (toolbarAssignee && item.assigneeId !== toolbarAssignee) {
      return false;
    }

    if (search) {
      const haystack = [
        item.title,
        item.status,
        item.type,
        item.priority,
        item.projectId,
        CHARTS_SAMPLE_MEMBERS.find((member) => member.id === item.assigneeId)
          ?.name ?? 'unassigned',
        CHARTS_SAMPLE_PROJECTS.find((project) => project.id === item.projectId)
          ?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (!filters) {
      return true;
    }

    if (filters.mode === 'quick') {
      return (
        matchesQuickSelection(
          item,
          'project',
          filters.quickSelections.project
        ) &&
        matchesQuickSelection(item, 'status', filters.quickSelections.status) &&
        matchesQuickSelection(item, 'type', filters.quickSelections.type) &&
        matchesQuickSelection(
          item,
          'assignee',
          filters.quickSelections.assignee
        ) &&
        matchesQuickSelection(
          item,
          'priority',
          filters.quickSelections.priority
        )
      );
    }

    if (filters.projectId !== 'all' && item.projectId !== filters.projectId) {
      return false;
    }

    return filters.rows.every((row) => matchesAdvancedRow(item, row));
  });
}

export function countChartsSampleMatches(
  filters: ChartsWidgetFilterDraft,
  options?: {
    readonly search?: string;
    readonly assigneeId?: string | null;
  }
): number {
  return filterChartsSampleWorkItems(CHARTS_SAMPLE_WORK_ITEMS, filters, options)
    .length;
}
