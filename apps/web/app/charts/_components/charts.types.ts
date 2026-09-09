import type { WorkItemStatus } from '@repo/types';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';

export type ChartBoardOwnershipFilter = 'all' | 'mine' | 'shared';
export type ChartBoardStatusFilter = 'all' | 'active' | 'archived';

/** UI stub shape for a persisted chart board (JSON layout later). */
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
   * When set (e.g. after a pie-slice click), the table shows only this
   * status group. Cleared when the user picks Chart / Table / Split from
   * the layout menu without a slice filter.
   */
  readonly focusedStatus?: WorkItemStatus;
};
