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

/** Instance placed on the board canvas (drag / resize). */
export type ChartBoardWidgetInstance = {
  readonly instanceId: string;
  readonly typeId: ChartWidgetTypeId;
  /** User-renamed label; falls back to catalog title when unset. */
  readonly title?: string;
};
