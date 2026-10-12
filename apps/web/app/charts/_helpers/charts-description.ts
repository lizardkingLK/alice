import { defaultTitleForChartWidgetType } from '@/app/charts/_helpers/charts-burndown-widget';
import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

/**
 * Tooltip / display blurb for a chart workspace or widget.
 * Empty description falls back to the same default string used for the name.
 */
export function resolveChartsDescription(params: {
  readonly description?: string | null;
  readonly title?: string | null;
  readonly typeId?: ChartWidgetTypeId;
}): string {
  const trimmed = params.description?.trim();
  if (trimmed) {
    return trimmed;
  }
  const title = params.title?.trim();
  if (title) {
    return title;
  }
  if (params.typeId) {
    return defaultTitleForChartWidgetType(params.typeId);
  }
  return 'Charts';
}
