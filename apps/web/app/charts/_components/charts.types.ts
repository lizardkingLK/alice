import type { LayoutItem } from 'react-grid-layout';
import type {
  ChartsLabelFieldId,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartsSliceColorToken } from '@/app/charts/_helpers/charts-slice-colors';

export type { ChartsSliceColorToken };
export type ChartBoardOwnershipFilter = 'all' | 'mine' | 'shared';
export type ChartBoardStatusFilter = 'all' | 'active' | 'archived';

export type { ChartsLabelFieldId };

/** UI stub shape for a persisted chart board list row. */
export type ChartBoardSummary = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly ownership: 'mine' | 'shared';
  readonly status: 'active' | 'archived';
  readonly updated_at: string;
};

export type ChartWidgetTypeId =
  | 'chart'
  | 'data-over-time'
  | 'numbers'
  | 'battery'
  | 'gantt'
  | 'files-gallery'
  | 'apps'
  | 'bar'
  | 'kpi'
  | 'table'
  | 'list'
  | 'burndown';

export type ChartWidgetCatalogItem = {
  readonly id: ChartWidgetTypeId;
  readonly title: string;
  readonly description: string;
};

/** How a Chart widget body is composed (persisted on the instance). */
export type ChartWidgetViewMode = 'chart' | 'table' | 'split';

/** Chart family subtype for Chart widgets (default donut matches today’s wheel). */
export type ChartPieVariant = 'pie' | 'donut' | 'bar';

/** Shared persist callbacks used by widget card + config dialog. */
export type ChartsWidgetFiltersChangeHandler = (
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  filters: ChartsWidgetFilterDraft | null
) => void;

export type ChartsWidgetViewModeChangeHandler = (
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  viewMode: ChartWidgetViewMode,
  /**
   * Bucket key for the clicked Labels slice (status id, assignee id, …).
   * Null clears the focus.
   */
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  focusedSliceKey?: string | null
) => void;

export type ChartsWidgetPieVariantChangeHandler = (
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  variant: ChartPieVariant
) => void;

export type ChartsWidgetLabelFieldChangeHandler = (
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  labelField: ChartsLabelFieldId
) => void;

/** Instance placed on the board canvas (drag / resize). */
export type ChartBoardWidgetInstance = {
  readonly instanceId: string;
  readonly typeId: ChartWidgetTypeId;
  /** User-renamed label; falls back to catalog title when unset. */
  readonly title?: string;
  /** Applied Advanced/Quick filters for chart widgets (local board JSON). */
  readonly filters?: ChartsWidgetFilterDraft;
  /** Chart / Table / Split — fullscreen preview only; canvas always shows the pie. */
  readonly viewMode?: ChartWidgetViewMode;
  /**
   * When set (after a pie-slice / legend click), Split/Table scopes rows to
   * that Labels bucket. For Status labels the table shows only that status
   * group; for other labels rows are filtered to the bucket then still grouped
   * by status. Cleared when the user picks a layout without a slice focus.
   */
  readonly focusedSliceKey?: string;
  /** Pie / donut / bar for Chart widgets; defaults to donut when unset. */
  readonly pieVariant?: ChartPieVariant;
  /**
   * Labels → Columns group-by field for Chart widgets.
   * Defaults to `status` when unset.
   */
  readonly labelField?: ChartsLabelFieldId;
  /** Values measure — Tier 1 supports item count only. */
  readonly measure?: 'item_count';
  /** Customize: show slice labels as raw count or percent of total. */
  readonly showValueAs?: ChartsShowValueAs;
  /** Customize: sort slices in the pie/legend. */
  readonly sortSlicesBy?: ChartsSortSlicesBy;
  /** Customize: include zero-count slices when the series returns them. */
  readonly showEmptySlices?: boolean;
  /**
   * Drilldown table columns to show.
   * When unset, defaults to Task / Owner / Status / Type / Priority
   * (Project and Sprint stay optional / off).
   */
  readonly visibleTableColumns?: readonly ChartsTableColumnId[];
  /**
   * Customize: per-slice theme token overrides (`sliceKey` → `chart-N`).
   * Cleared when Labels → Columns changes.
   */
  readonly sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>;
};

export type ChartsShowValueAs = 'value' | 'percent';

export type ChartsSortSlicesBy =
  'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';

export const CHARTS_TABLE_COLUMN_IDS = [
  'task',
  'owner',
  'status',
  'type',
  'priority',
  'project',
  'sprint',
  'actions',
] as const;

export type ChartsTableColumnId = (typeof CHARTS_TABLE_COLUMN_IDS)[number];

/** Columns checked by default in widget settings (and when unset on a widget). */
export const DEFAULT_CHARTS_VISIBLE_TABLE_COLUMNS: readonly ChartsTableColumnId[] =
  ['task', 'owner', 'status', 'type', 'priority', 'actions'];

export const CHARTS_TABLE_COLUMN_LABELS: Record<ChartsTableColumnId, string> = {
  task: 'Task',
  owner: 'Owner',
  status: 'Status',
  type: 'Type',
  priority: 'Priority',
  project: 'Project',
  sprint: 'Sprint',
  actions: 'Actions',
};

export type ChartWidgetDisplaySettingsPatch = {
  readonly showValueAs?: ChartsShowValueAs;
  readonly sortSlicesBy?: ChartsSortSlicesBy;
  readonly showEmptySlices?: boolean;
  readonly visibleTableColumns?: readonly ChartsTableColumnId[];
  /** Pass `null` or `{}` to clear overrides. */
  readonly sliceColors?: Readonly<Record<string, ChartsSliceColorToken>> | null;
};

/** Persisted chart workspace (`charts` row; client holds in-memory only). */
export type ChartWorkspaceRecord = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: 'active' | 'archived';
  readonly isOverview: boolean;
  readonly updatedAt: string;
  /** Owner vs shared ACL; defaults to mine. */
  readonly ownership?: 'mine' | 'shared';
  readonly instances: ChartBoardWidgetInstance[];
  readonly layout: LayoutItem[];
};
