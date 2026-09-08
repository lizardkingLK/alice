import type { ComponentType, SVGProps } from 'react';
import {
  BarChart3,
  BatteryMedium,
  ChartLine,
  ChartPie,
  Code2,
  FileStack,
  GanttChart,
  Hash,
  LayoutList,
  Table2,
  Timer,
} from '@repo/ui/lib/icons';
import type {
  ChartWidgetCatalogItem,
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';

type WidgetIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ChartWidgetCategoryId =
  'staying-on-top' | 'delivery' | 'media' | 'personal' | 'apps';

export type ChartWidgetDefinition = ChartWidgetCatalogItem & {
  readonly icon: WidgetIcon;
  readonly category: ChartWidgetCategoryId;
  /** Shown in the quick + Add Widget dropdown. */
  readonly quickAdd?: boolean;
};

export type ChartWidgetCategory = {
  readonly id: ChartWidgetCategoryId;
  readonly label: string;
};

export const CHART_WIDGET_CATEGORIES: readonly ChartWidgetCategory[] = [
  { id: 'staying-on-top', label: 'Staying on Top' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'media', label: 'Media' },
  { id: 'personal', label: 'Personal' },
  { id: 'apps', label: 'Apps' },
] as const;

/** Full Widgets catalog (Monday-style groupings, Alice-flavored copy). */
export const CHART_WIDGET_CATALOG: readonly ChartWidgetDefinition[] = [
  {
    id: 'chart',
    title: 'Chart',
    description: 'Create a chart widget to visually show data from your boards',
    icon: ChartPie,
    category: 'staying-on-top',
    quickAdd: true,
  },
  {
    id: 'data-over-time',
    title: 'Data over time',
    description: 'Show how data changes over time',
    icon: ChartLine,
    category: 'staying-on-top',
    quickAdd: true,
  },
  {
    id: 'numbers',
    title: 'Numbers',
    description: 'Get a quick view on all number columns',
    icon: Hash,
    category: 'staying-on-top',
    quickAdd: true,
  },
  {
    id: 'battery',
    title: 'Battery',
    description: 'Your progress at a glance',
    icon: BatteryMedium,
    category: 'staying-on-top',
    quickAdd: true,
  },
  {
    id: 'gantt',
    title: 'Gantt',
    description: 'Plan, track and present your projects visually using Gantt',
    icon: GanttChart,
    category: 'delivery',
    quickAdd: true,
  },
  {
    id: 'files-gallery',
    title: 'Files Gallery',
    description: 'Manage and collaborate on your files with your team',
    icon: FileStack,
    category: 'media',
    quickAdd: true,
  },
  {
    id: 'apps',
    title: 'Apps',
    description: 'Enhance your dashboard with integration-powered widgets',
    icon: Code2,
    category: 'apps',
    quickAdd: true,
  },
  {
    id: 'bar',
    title: 'Bar chart',
    description: 'Compare counts or totals across categories',
    icon: BarChart3,
    category: 'staying-on-top',
  },
  {
    id: 'kpi',
    title: 'KPI card',
    description: 'Highlight a single number with optional delta',
    icon: Hash,
    category: 'personal',
  },
  {
    id: 'table',
    title: 'Table',
    description: 'View and interact with items from multiple boards',
    icon: Table2,
    category: 'staying-on-top',
  },
  {
    id: 'list',
    title: 'List view',
    description:
      'Manage and track items from multiple boards in a unified list',
    icon: LayoutList,
    category: 'staying-on-top',
  },
  {
    id: 'burndown',
    title: 'Burndown',
    description: 'Sprint remaining work over the timeline',
    icon: Timer,
    category: 'delivery',
  },
] as const;

export const CHART_QUICK_ADD_WIDGETS = CHART_WIDGET_CATALOG.filter(
  (item) => item.quickAdd
);

export function chartWidgetById(
  id: ChartWidgetTypeId
): ChartWidgetDefinition | undefined {
  return CHART_WIDGET_CATALOG.find((item) => item.id === id);
}

export function chartWidgetsForCategory(
  categoryId: ChartWidgetCategoryId
): ChartWidgetDefinition[] {
  return CHART_WIDGET_CATALOG.filter((item) => item.category === categoryId);
}
