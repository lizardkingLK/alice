import type { LayoutItem } from 'react-grid-layout';
import type {
  ChartsLabelFieldId,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';

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

/** Pie family subtype for Chart widgets (default donut matches today’s wheel). */
export type ChartPieVariant = 'pie' | 'donut';

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
  /** Pie vs donut for Chart widgets; defaults to donut when unset. */
  readonly pieVariant?: ChartPieVariant;
  /**
   * Labels → Columns group-by field for Chart widgets.
   * Defaults to `status` when unset.
   */
  readonly labelField?: ChartsLabelFieldId;
};

/** Persisted chart workspace (localStorage / future `charts` row). */
export type ChartWorkspaceRecord = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: 'active' | 'archived';
  readonly isOverview: boolean;
  readonly updatedAt: string;
  readonly instances: ChartBoardWidgetInstance[];
  readonly layout: LayoutItem[];
};

export type ChartWorkspacesStore = {
  readonly workspaces: ChartWorkspaceRecord[];
  readonly lastOpenedId: string | null;
};
