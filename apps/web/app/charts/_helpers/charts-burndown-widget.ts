import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

/** Catalog ids that render the sprint burndown widget. */
export function isBurndownWidgetType(typeId: ChartWidgetTypeId): boolean {
  return typeId === 'burndown' || typeId === 'data-over-time';
}

export const CHARTS_BURNDOWN_DEFAULT_TITLE = 'Sprint burndown';

/** Board card title when the instance has no custom label. */
export function defaultTitleForChartWidgetType(
  typeId: ChartWidgetTypeId | undefined
): string {
  if (typeId === 'chart') {
    return 'Tasks by status';
  }
  if (typeId && isBurndownWidgetType(typeId)) {
    return CHARTS_BURNDOWN_DEFAULT_TITLE;
  }
  return 'Widget';
}
