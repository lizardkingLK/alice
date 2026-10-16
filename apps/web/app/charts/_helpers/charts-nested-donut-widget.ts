import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

/** Catalog id for the nested hierarchy donut widget. */
export function isNestedDonutWidgetType(typeId: ChartWidgetTypeId): boolean {
  return typeId === 'nested-donut';
}

export const CHARTS_NESTED_DONUT_DEFAULT_TITLE = 'Hierarchy by parent';

/** Breadcrumb step when digging into a nested-donut slice. */
export type ChartsHierarchyDigStep = {
  readonly id: string;
  readonly label: string;
};

/**
 * Dig (zoom) vs drilldown: diggable slices zoom when Chart mode is active;
 * Table/Split (`preferDrilldown`) and leaves always focus work-item rows.
 */
export function shouldDigHierarchySlice(options: {
  readonly preferDrilldown: boolean;
  readonly hasChildren: boolean;
  readonly digEnabled: boolean;
}): boolean {
  return !options.preferDrilldown && options.hasChildren && options.digEnabled;
}
