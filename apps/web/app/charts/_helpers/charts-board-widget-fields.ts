import type {
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetViewMode,
} from '@/app/charts/_components/charts.types';
import { resolveChartAnalyticsProjectId } from '@/app/charts/_helpers/charts-analytics.ui';

/**
 * Older board JSON stored status focus as `focusedStatus`.
 * Prefer `focusedSliceKey` everywhere going forward.
 */
export function resolveFocusedSliceKey(source: {
  readonly focusedSliceKey?: string;
  readonly focusedStatus?: string;
}): string | undefined {
  return source.focusedSliceKey ?? source.focusedStatus;
}

type ChartInstanceFieldPatch = Partial<
  Pick<
    ChartBoardWidgetInstance,
    | 'title'
    | 'description'
    | 'filters'
    | 'viewMode'
    | 'focusedSliceKey'
    | 'pieVariant'
    | 'labelField'
    | 'showValueAs'
    | 'sortSlicesBy'
    | 'showEmptySlices'
    | 'visibleTableColumns'
    | 'sliceColors'
  >
> & {
  readonly clearFilters?: boolean;
  readonly clearFocusedSliceKey?: boolean;
  readonly clearPieVariant?: boolean;
  readonly clearLabelField?: boolean;
  readonly clearShowValueAs?: boolean;
  readonly clearSortSlicesBy?: boolean;
  readonly clearShowEmptySlices?: boolean;
  readonly clearVisibleTableColumns?: boolean;
  readonly clearSliceColors?: boolean;
};

/** Persist a field only when set and not the omitted default. */
function assignNonDefaultField<K extends keyof ChartBoardWidgetInstance>(
  target: ChartBoardWidgetInstance,
  key: K,
  value: ChartBoardWidgetInstance[K] | undefined,
  isOmittedDefault: boolean
): void {
  if (value == null || isOmittedDefault) {
    return;
  }
  Object.assign(target, { [key]: value });
}

function assignUnlessCleared<K extends keyof ChartBoardWidgetInstance>(
  target: ChartBoardWidgetInstance,
  cleared: boolean | undefined,
  key: K,
  value: ChartBoardWidgetInstance[K] | undefined,
  isOmittedDefault = false
): void {
  if (cleared) {
    return;
  }
  assignNonDefaultField(target, key, value, isOmittedDefault);
}

function withInstanceFields(
  item: ChartBoardWidgetInstance,
  patch: ChartInstanceFieldPatch
): ChartBoardWidgetInstance {
  const next: ChartBoardWidgetInstance = {
    instanceId: item.instanceId,
    typeId: item.typeId,
  };

  const title = patch.title ?? item.title;
  if (title) {
    Object.assign(next, { title });
  }

  const description = patch.description ?? item.description;
  if (description) {
    Object.assign(next, { description });
  }

  assignUnlessCleared(
    next,
    patch.clearFilters,
    'filters',
    patch.filters ?? item.filters
  );

  const viewMode = patch.viewMode ?? item.viewMode;
  assignNonDefaultField(next, 'viewMode', viewMode, viewMode === 'chart');

  assignUnlessCleared(
    next,
    patch.clearFocusedSliceKey,
    'focusedSliceKey',
    patch.focusedSliceKey ?? resolveFocusedSliceKey(item)
  );

  const pieVariant = patch.pieVariant ?? item.pieVariant;
  assignUnlessCleared(
    next,
    patch.clearPieVariant,
    'pieVariant',
    pieVariant,
    pieVariant === 'donut'
  );

  const labelField = patch.labelField ?? item.labelField;
  assignUnlessCleared(
    next,
    patch.clearLabelField,
    'labelField',
    labelField,
    labelField === 'category'
  );

  const showValueAs = patch.showValueAs ?? item.showValueAs;
  assignUnlessCleared(
    next,
    patch.clearShowValueAs,
    'showValueAs',
    showValueAs,
    showValueAs === 'percent'
  );

  const sortSlicesBy = patch.sortSlicesBy ?? item.sortSlicesBy;
  assignUnlessCleared(
    next,
    patch.clearSortSlicesBy,
    'sortSlicesBy',
    sortSlicesBy,
    sortSlicesBy === 'value_desc'
  );

  const showEmptySlices = patch.showEmptySlices ?? item.showEmptySlices;
  assignUnlessCleared(
    next,
    patch.clearShowEmptySlices,
    'showEmptySlices',
    showEmptySlices,
    showEmptySlices === false || showEmptySlices == null
  );

  const visibleTableColumns =
    patch.visibleTableColumns ?? item.visibleTableColumns;
  assignUnlessCleared(
    next,
    patch.clearVisibleTableColumns,
    'visibleTableColumns',
    visibleTableColumns
  );

  assignUnlessCleared(
    next,
    patch.clearSliceColors,
    'sliceColors',
    patch.sliceColors ?? item.sliceColors
  );

  return next;
}

export function updateChartWidgetFilters(
  instanceId: string,
  filters: ChartBoardWidgetInstance['filters'] | null,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    const nextFilters = filters ?? null;
    const projectId = resolveChartAnalyticsProjectId(nextFilters);
    const clearStateLabel = item.labelField === 'state' && projectId === null;
    if (!nextFilters) {
      return withInstanceFields(item, {
        clearFilters: true,
        ...(clearStateLabel
          ? {
              clearLabelField: true,
              clearFocusedSliceKey: true,
              clearSliceColors: true,
            }
          : {}),
      });
    }
    return withInstanceFields(item, {
      filters: nextFilters,
      ...(clearStateLabel
        ? {
            clearLabelField: true,
            clearFocusedSliceKey: true,
            clearSliceColors: true,
          }
        : {}),
    });
  });
}

export function updateChartWidgetViewMode(
  instanceId: string,
  viewMode: ChartWidgetViewMode,
  focusedSliceKey: string | null | undefined,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    return withInstanceFields(item, {
      viewMode,
      focusedSliceKey: focusedSliceKey ?? undefined,
      clearFocusedSliceKey: focusedSliceKey == null,
    });
  });
}

export function updateChartWidgetPieVariant(
  instanceId: string,
  pieVariant: ChartPieVariant,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    if (pieVariant === 'donut') {
      return withInstanceFields(item, { clearPieVariant: true });
    }
    return withInstanceFields(item, { pieVariant });
  });
}

export function updateChartWidgetLabelField(
  instanceId: string,
  labelField: ChartsLabelFieldId,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    if (labelField === 'category') {
      return withInstanceFields(item, {
        clearLabelField: true,
        clearFocusedSliceKey: true,
        clearSliceColors: true,
      });
    }
    return withInstanceFields(item, {
      labelField,
      clearFocusedSliceKey: true,
      clearSliceColors: true,
    });
  });
}

export function updateChartWidgetDisplaySettings(
  instanceId: string,
  patch: ChartWidgetDisplaySettingsPatch,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    return withInstanceFields(item, displaySettingsPatch(patch));
  });
}

function displaySettingsPatch(
  patch: ChartWidgetDisplaySettingsPatch
): ChartInstanceFieldPatch {
  const next: ChartInstanceFieldPatch = {};
  applyShowValueAsPatch(patch, next);
  applySortSlicesByPatch(patch, next);
  applyShowEmptySlicesPatch(patch, next);
  applyVisibleTableColumnsPatch(patch, next);
  applySliceColorsPatch(patch, next);
  return next;
}

function applyShowValueAsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.showValueAs === undefined) {
    return;
  }
  if (patch.showValueAs === 'percent') {
    Object.assign(next, { clearShowValueAs: true });
    return;
  }
  Object.assign(next, { showValueAs: patch.showValueAs });
}

function applySortSlicesByPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.sortSlicesBy === undefined) {
    return;
  }
  if (patch.sortSlicesBy === 'value_desc') {
    Object.assign(next, { clearSortSlicesBy: true });
    return;
  }
  Object.assign(next, { sortSlicesBy: patch.sortSlicesBy });
}

function applyShowEmptySlicesPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.showEmptySlices === undefined) {
    return;
  }
  if (patch.showEmptySlices) {
    Object.assign(next, { showEmptySlices: true });
    return;
  }
  Object.assign(next, { clearShowEmptySlices: true });
}

function applyVisibleTableColumnsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.visibleTableColumns === undefined) {
    return;
  }
  Object.assign(next, {
    visibleTableColumns: patch.visibleTableColumns,
    clearVisibleTableColumns: false,
  });
}

function applySliceColorsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.sliceColors === undefined) {
    return;
  }
  if (
    patch.sliceColors == null ||
    Object.keys(patch.sliceColors).length === 0
  ) {
    Object.assign(next, { clearSliceColors: true });
    return;
  }
  Object.assign(next, {
    sliceColors: patch.sliceColors,
    clearSliceColors: false,
  });
}
