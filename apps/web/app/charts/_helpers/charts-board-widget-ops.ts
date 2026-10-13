import type { LayoutItem } from 'react-grid-layout';
import { chartWidgetById } from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartBoardWidgetInstance,
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';
import {
  createChartWidgetInstanceId,
  nextChartLayoutItem,
} from '@/app/charts/_helpers/charts-board-layout';
import {
  resolveFocusedSliceKey,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
} from '@/app/charts/_helpers/charts-board-widget-fields';

/** Helper for parent: append a widget of the given type. */
export function appendChartWidget(
  typeId: ChartWidgetTypeId,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[],
  options?: {
    title?: string;
    sizeOverride?: Partial<Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>>;
    filters?: ChartsWidgetFilterDraft;
    scopeLocked?: boolean;
  }
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  const instanceId = createChartWidgetInstanceId();
  const nextInstances = [
    ...instances,
    {
      instanceId,
      typeId,
      ...(options?.title ? { title: options.title } : {}),
      ...(options?.filters ? { filters: options.filters } : {}),
      ...(options?.scopeLocked ? { scopeLocked: true } : {}),
    },
  ];
  const nextLayout = [
    ...layout,
    nextChartLayoutItem(instanceId, layout, typeId, options?.sizeOverride),
  ];
  return { instances: nextInstances, layout: nextLayout };
}

export function removeChartWidget(
  instanceId: string,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[]
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  return {
    instances: instances.filter((item) => item.instanceId !== instanceId),
    layout: layout.filter((item) => item.i !== instanceId),
  };
}

export function duplicateChartWidget(
  instanceId: string,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[]
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  const source = instances.find((item) => item.instanceId === instanceId);
  if (!source) {
    return { instances, layout };
  }

  const catalogTitle = chartWidgetById(source.typeId)?.title;
  const displayFallback =
    source.typeId === 'chart' ? 'Tasks by status' : catalogTitle;
  const baseTitle = source.title?.trim() || displayFallback || 'Widget';
  const sourceLayout = layout.find((item) => item.i === instanceId);
  const sizeOverride = sourceLayout
    ? {
        w: sourceLayout.w,
        h: sourceLayout.h,
        minW: sourceLayout.minW,
        minH: sourceLayout.minH,
      }
    : undefined;

  const next = appendChartWidget(source.typeId, instances, layout, {
    title: `${baseTitle} (copy)`,
    sizeOverride,
  });
  const copiedId = next.instances.at(-1)?.instanceId;
  if (!copiedId) {
    return next;
  }

  let nextInstances = next.instances;
  if (source.filters) {
    nextInstances = updateChartWidgetFilters(
      copiedId,
      source.filters,
      nextInstances
    );
  }
  if (source.scopeLocked) {
    nextInstances = nextInstances.map((item) =>
      item.instanceId === copiedId ? { ...item, scopeLocked: true } : item
    );
  }
  const sourceFocus = resolveFocusedSliceKey(source);
  if (source.viewMode || sourceFocus) {
    nextInstances = updateChartWidgetViewMode(
      copiedId,
      source.viewMode ?? 'chart',
      sourceFocus ?? null,
      nextInstances
    );
  }
  if (source.pieVariant && source.pieVariant !== 'donut') {
    nextInstances = updateChartWidgetPieVariant(
      copiedId,
      source.pieVariant,
      nextInstances
    );
  }
  if (source.labelField && source.labelField !== 'category') {
    nextInstances = updateChartWidgetLabelField(
      copiedId,
      source.labelField,
      nextInstances
    );
  }
  return { ...next, instances: nextInstances };
}

export function renameChartWidget(
  instanceId: string,
  title: string,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return saveChartWidgetMeta(instanceId, { title }, instances);
}

/** Persist Save option fields (name + optional description) on a widget instance. */
export function saveChartWidgetMeta(
  instanceId: string,
  meta: { readonly title: string; readonly description?: string | null },
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  const trimmedTitle = meta.title.trim();
  const nextDescription =
    meta.description === undefined
      ? undefined
      : meta.description?.trim() || null;
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    const next: ChartBoardWidgetInstance = {
      ...item,
      title: trimmedTitle,
    };
    if (nextDescription === undefined) {
      return next;
    }
    if (nextDescription === null) {
      const rest = { ...next };
      delete rest.description;
      return rest;
    }
    return { ...next, description: nextDescription };
  });
}
