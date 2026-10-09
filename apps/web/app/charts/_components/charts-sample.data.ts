import {
  BOARD_WORK_ITEM_STATUSES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
} from '@repo/types';
import { PRIORITY_LABELS } from '@/app/work-items/_helpers/work-item-priority-ui';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';

/** Assignee option for chart filters (accessible project members). */
export type ChartsSampleMember = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profilePicture: string | null;
};

/** Lightweight project option for chart filters (id + display name). */
export type ChartsProjectOption = {
  readonly id: string;
  readonly name: string;
};

/** Monday-style Labels → Columns options (pie group-by). */
export type ChartsLabelFieldId =
  | 'board'
  | 'group'
  | 'name'
  | 'owner'
  | 'status'
  | 'category'
  | 'state'
  | 'dueDate'
  | 'type'
  | 'priority';

export const CHARTS_LABEL_COLUMNS: readonly {
  readonly id: ChartsLabelFieldId;
  readonly label: string;
}[] = [
  { id: 'board', label: 'Project' },
  { id: 'group', label: 'Group' },
  { id: 'name', label: 'Name' },
  { id: 'owner', label: 'Owner' },
  { id: 'category', label: 'Category' },
  { id: 'state', label: 'State' },
  { id: 'status', label: 'Status' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'type', label: 'Type' },
  { id: 'priority', label: 'Priority' },
] as const;

export const DEFAULT_CHARTS_LABEL_FIELD: ChartsLabelFieldId = 'category';

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
  column: ChartsFilterColumnId,
  members: readonly ChartsSampleMember[] = []
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
        ...members.map((member) => ({
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
  'project' | 'sprint' | 'status' | 'type' | 'assignee' | 'priority';

export type ChartsSprintOption = {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
};

const QUICK_FIELD_ALL_LABELS: Record<
  Exclude<ChartsQuickFieldId, 'project' | 'sprint' | 'assignee'>,
  string
> = {
  status: 'All statuses',
  type: 'All types',
  priority: 'All priorities',
};

/** Sprint options for a concrete project (All projects → All sprints only). */
export function chartsSprintFieldOptions(
  sprints: readonly ChartsSprintOption[],
  projectId: string | null | undefined
): readonly ChartsFilterOption[] {
  const all = { value: 'all', label: 'All sprints' } as const;
  if (!projectId || projectId === 'all') {
    return [all];
  }
  return [
    all,
    ...sprints
      .filter((sprint) => sprint.projectId === projectId)
      .map((sprint) => ({
        value: sprint.id,
        label: sprint.name,
      })),
  ];
}

/** Quick-filter option lists (includes an “all” sentinel). */
export function chartsQuickFieldOptions(
  field: ChartsQuickFieldId,
  projects: readonly ChartsProjectOption[] = [],
  options?: {
    readonly sprints?: readonly ChartsSprintOption[];
    readonly projectId?: string | null;
    readonly members?: readonly ChartsSampleMember[];
  }
): readonly ChartsFilterOption[] {
  if (field === 'project') {
    return [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ];
  }
  if (field === 'sprint') {
    return chartsSprintFieldOptions(options?.sprints ?? [], options?.projectId);
  }
  if (field === 'assignee') {
    return [
      { value: 'all', label: 'Anyone' },
      ...chartsFilterValueOptions('assignee', options?.members),
    ];
  }
  return [
    { value: 'all', label: QUICK_FIELD_ALL_LABELS[field] },
    ...chartsFilterValueOptions(field, options?.members),
  ];
}

export type ChartsWidgetFilterDraft = {
  readonly mode: 'advanced' | 'quick';
  readonly projectId: string;
  /** Optional sprint scope (seeded from workspace defaults; passed to analytics). */
  readonly sprintId?: string;
  readonly rows: readonly ChartsAdvancedFilterRow[];
  readonly quickSelections: Readonly<Record<ChartsQuickFieldId, string>>;
};
