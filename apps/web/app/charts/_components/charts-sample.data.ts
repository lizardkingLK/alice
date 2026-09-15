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
import { STATUS_CHART_COLORS } from '@/components/status-distribution-wheel';

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
  /** Synthetic Monday-style board group for Labels → Group. */
  readonly group: string;
  /**
   * TipTap JSON or plain text — same shapes the work-item form can store.
   * `null` means no description.
   */
  readonly description: string | Record<string, unknown> | null;
  /** ISO date `YYYY-MM-DD` or null. */
  readonly dueDate: string | null;
  readonly storyPoints: number | null;
  readonly labels: readonly string[];
};

/** Monday-style Labels → Columns options (pie group-by). */
export type ChartsLabelFieldId =
  'board' | 'group' | 'name' | 'owner' | 'status' | 'dueDate';

export const CHARTS_LABEL_COLUMNS: readonly {
  readonly id: ChartsLabelFieldId;
  readonly label: string;
}[] = [
  { id: 'board', label: 'Board' },
  { id: 'group', label: 'Group' },
  { id: 'name', label: 'Name' },
  { id: 'owner', label: 'Owner' },
  { id: 'status', label: 'Status' },
  { id: 'dueDate', label: 'Due date' },
] as const;

export const DEFAULT_CHARTS_LABEL_FIELD: ChartsLabelFieldId = 'status';

export const CHARTS_SAMPLE_GROUPS = [
  'To do',
  'Working on it',
  'Stuck',
  'Done this week',
] as const;

const CHART_TOKEN_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Sample project the signed-in user would be a member of.
 * IDs are UUIDs so the real work-item form Zod schemas accept them in mock create/edit.
 */
export const CHARTS_SAMPLE_PROJECTS: readonly ChartsSampleProject[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    key: 'ALICE',
    name: 'Alice Platform',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    key: 'DEMO',
    name: 'Demo Delivery',
  },
] as const;

export const CHARTS_SAMPLE_MEMBERS: readonly ChartsSampleMember[] = (
  [
    ['22222222-2222-4222-8222-222222222201', 'Alice Admin', 'admin@alice.dev'],
    ['22222222-2222-4222-8222-222222222202', 'Bob Member', 'bob@alice.dev'],
    ['22222222-2222-4222-8222-222222222203', 'Cara Manager', 'cara@alice.dev'],
    ['22222222-2222-4222-8222-222222222204', 'Dan Designer', 'dan@alice.dev'],
    ['22222222-2222-4222-8222-222222222205', 'Eve Engineer', 'eve@alice.dev'],
  ] as const
).map(([id, name, email]) => ({
  id,
  name,
  email,
  profilePicture: null,
}));

/** Seed titles — expanded procedurally to ~100 rows for table pagination demos. */
const CHARTS_SAMPLE_TITLE_SEEDS = [
  'Database Setup and Prisma Migration',
  'Implement Core User Model',
  'Projects & Memberships',
  'Teams and Reporting Lines',
  'Sprints Engine',
  'Work Items Hierarchy',
  'Comments and Attachments',
  'Access Allowlist',
  'Jira OAuth Sync',
  'Charts Board Canvas',
  'Dashboard Grid Layout',
  'Notification Preferences',
  'Saved Views Sharing',
  'Backlog Ranking',
  'Sprint Report Export',
  'Realtime Presence',
  'File Upload Pipeline',
  'RBAC Policy Audit',
  'Search Index Sync',
  'Docs Publish Manifest',
] as const;

const SAMPLE_WORK_ITEM_COUNT = 100;

function sampleDueDate(index: number): string | null {
  // Every 5th item has no due date so the "No due date" bucket is non-empty.
  if (index % 5 === 0) {
    return null;
  }
  const month = ((index % 12) + 1).toString().padStart(2, '0');
  const day = ((index % 28) + 1).toString().padStart(2, '0');
  return `2026-${month}-${day}`;
}

function buildChartsSampleWorkItems(): readonly ChartsSampleWorkItem[] {
  const statuses = BOARD_WORK_ITEM_STATUSES;
  const types = WORK_ITEM_TYPES;
  const priorities = WORK_ITEM_PRIORITIES;
  const memberIds = [
    ...CHARTS_SAMPLE_MEMBERS.map((member) => member.id),
    null,
  ] as const;
  const projectIds = CHARTS_SAMPLE_PROJECTS.map((project) => project.id);

  return Array.from({ length: SAMPLE_WORK_ITEM_COUNT }, (_, index) => {
    const n = index + 1;
    const seed =
      CHARTS_SAMPLE_TITLE_SEEDS[index % CHARTS_SAMPLE_TITLE_SEEDS.length] ??
      'Sample task';
    const batch = Math.floor(index / CHARTS_SAMPLE_TITLE_SEEDS.length) + 1;
    return {
      id: `wi-${n}`,
      title: batch === 1 ? seed : `${seed} (${batch})`,
      status: statuses[index % statuses.length] as WorkItemStatus,
      type: types[index % types.length] as WorkItemType,
      priority: priorities[index % priorities.length] as WorkItemPriority,
      assigneeId: memberIds[index % memberIds.length] ?? null,
      projectId: projectIds[index % projectIds.length] as string,
      group: CHARTS_SAMPLE_GROUPS[
        index % CHARTS_SAMPLE_GROUPS.length
      ] as string,
      description: null,
      dueDate: sampleDueDate(index),
      storyPoints: null,
      labels: [],
    };
  });
}

export const CHARTS_SAMPLE_WORK_ITEMS: readonly ChartsSampleWorkItem[] =
  buildChartsSampleWorkItems();

export type ChartsStatusPieSlice = {
  /** ChartConfig / Pie nameKey — CSS-safe id. */
  readonly status: string;
  /** Stable bucket identity (project id, status, title, …). */
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly percent: string;
  readonly fill: string;
  readonly swatch: string;
};

const FALLBACK_STATUS_COLOR = 'var(--chart-1)';
const NO_DUE_DATE_KEY = '__no_due_date__';
const UNASSIGNED_KEY = 'unassigned';

function chartSafeKey(raw: string, index: number): string {
  const slug = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return slug.length > 0 ? `${slug}_${index}` : `bucket_${index}`;
}

function labelBucketForItem(
  item: ChartsSampleWorkItem,
  labelField: ChartsLabelFieldId
): { readonly key: string; readonly label: string } {
  switch (labelField) {
    case 'board': {
      const project = CHARTS_SAMPLE_PROJECTS.find(
        (entry) => entry.id === item.projectId
      );
      return {
        key: item.projectId,
        label: project?.name ?? item.projectId,
      };
    }
    case 'group':
      return { key: item.group, label: item.group };
    case 'name':
      return { key: item.title, label: item.title };
    case 'owner': {
      if (!item.assigneeId) {
        return { key: UNASSIGNED_KEY, label: 'Unassigned' };
      }
      const member = CHARTS_SAMPLE_MEMBERS.find(
        (entry) => entry.id === item.assigneeId
      );
      return {
        key: item.assigneeId,
        label: member?.name ?? item.assigneeId,
      };
    }
    case 'status':
      return {
        key: item.status,
        label: STATUS_META[item.status]?.label ?? item.status,
      };
    case 'dueDate': {
      if (!item.dueDate) {
        return { key: NO_DUE_DATE_KEY, label: 'No due date' };
      }
      const monthKey = item.dueDate.slice(0, 7);
      return { key: monthKey, label: monthKey };
    }
    default:
      return { key: 'unknown', label: 'Unknown' };
  }
}

function swatchForBucket(
  labelField: ChartsLabelFieldId,
  bucketKey: string,
  index: number
): string {
  if (labelField === 'status') {
    const statusColors = STATUS_CHART_COLORS as Partial<
      Record<WorkItemStatus, string>
    >;
    return statusColors[bucketKey as WorkItemStatus] ?? FALLBACK_STATUS_COLOR;
  }
  return CHART_TOKEN_COLORS[index % CHART_TOKEN_COLORS.length] as string;
}

/**
 * Aggregate mock rows by the Labels → Columns field and build pie slices.
 */
export function buildChartsPieFromSample(
  items: readonly ChartsSampleWorkItem[] = CHARTS_SAMPLE_WORK_ITEMS,
  labelField: ChartsLabelFieldId = DEFAULT_CHARTS_LABEL_FIELD
): {
  readonly data: ChartsStatusPieSlice[];
  readonly config: ChartConfig;
  readonly total: number;
} {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const bucket = labelBucketForItem(item, labelField);
    const existing = counts.get(bucket.key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(bucket.key, { label: bucket.label, count: 1 });
    }
  }

  let orderedKeys: string[];
  if (labelField === 'status') {
    orderedKeys = BOARD_WORK_ITEM_STATUSES.filter((status) =>
      counts.has(status)
    );
  } else {
    orderedKeys = [...counts.entries()]
      .sort(
        (a, b) =>
          b[1].count - a[1].count || a[1].label.localeCompare(b[1].label)
      )
      .map(([key]) => key);
  }

  const total = items.length;
  const data: ChartsStatusPieSlice[] = orderedKeys.map((bucketKey, index) => {
    const entry = counts.get(bucketKey);
    const count = entry?.count ?? 0;
    const label = entry?.label ?? bucketKey;
    const chartKey =
      labelField === 'status' ? bucketKey : chartSafeKey(bucketKey, index);
    const swatch = swatchForBucket(labelField, bucketKey, index);
    const percent =
      total === 0 ? '0%' : `${((count / total) * 100).toFixed(1)}%`;
    return {
      status: chartKey,
      key: bucketKey,
      label,
      count,
      percent,
      fill: `var(--color-${chartKey})`,
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

/** @deprecated Prefer `buildChartsPieFromSample(items, 'status')`. */
export function buildChartsStatusPieFromSample(
  items: readonly ChartsSampleWorkItem[] = CHARTS_SAMPLE_WORK_ITEMS
): {
  readonly data: ChartsStatusPieSlice[];
  readonly config: ChartConfig;
  readonly total: number;
} {
  return buildChartsPieFromSample(items, 'status');
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
  'project' | 'status' | 'type' | 'assignee' | 'priority';

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
        Object.entries(filters.quickSelections) as Array<
          [ChartsQuickFieldId, string]
        >
      ).every(([field, selected]) =>
        matchesQuickSelection(item, field, selected)
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
