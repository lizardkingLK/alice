import type { CreateChartBody, UpdateChartBody } from './charts.schemas';
import {
  chartCategoryDisplayLabel,
  chartDrilldownItemSelect,
  chartRollupGroupColumn,
  CHART_HIERARCHY_MAX_DEPTH,
  CHART_SERIES_NULL_SLICE_KEY,
  paginationMeta,
  parseWorkflowConfigEnvelope,
  type ChartDrilldownItemRow,
  type ChartHierarchyMeasure,
  type ChartHierarchyRing,
  type ChartHierarchyRingLevel,
  type ChartHierarchySlice,
  type ChartSeriesLabelField,
  type ChartSeriesSlice,
  type Database,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@repo/types';
import { Prisma, RecordStatus } from '@repo/types/prisma';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';

const EMPTY_BOARD_JSON = {
  instances: [],
  layout: [],
} as const satisfies Prisma.InputJsonObject;

function toPrismaBoardJson(
  value: CreateChartBody['board_json'] | UpdateChartBody['board_json']
): Prisma.InputJsonValue {
  return (value ?? EMPTY_BOARD_JSON) as Prisma.InputJsonValue;
}

export type ChartRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  board_json: unknown;
  show_on_dashboard: boolean;
  dashboard_sort_order: number;
  status: 'active' | 'archived' | 'inactive' | 'deleted';
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

function toChartRow(row: {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  board_json: unknown;
  show_on_dashboard: boolean;
  dashboard_sort_order: number;
  status: ChartRow['status'];
  created_by: string | null;
  created_at: Date;
  updated_by: string | null;
  updated_at: Date;
}): ChartRow {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    board_json: row.board_json,
    show_on_dashboard: row.show_on_dashboard,
    dashboard_sort_order: row.dashboard_sort_order,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_by: row.updated_by,
    updated_at: row.updated_at.toISOString(),
  };
}

function dateOnlyToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Inclusive `from`/`to` on `bucket_date` (DATE). */
function bucketDateWhere(
  from?: string,
  to?: string
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }
  return {
    ...(from ? { gte: dateOnlyToUtcDate(from) } : {}),
    ...(to ? { lte: dateOnlyToUtcDate(to) } : {}),
  };
}

/** Inclusive calendar-day range on timestamptz `created_at`. */
function createdAtWhere(
  from?: string,
  to?: string
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = dateOnlyToUtcDate(from);
  }
  if (to) {
    const endExclusive = dateOnlyToUtcDate(to);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    filter.lt = endExclusive;
  }
  return filter;
}

function sliceDimensionWhere(
  labelField: ChartSeriesLabelField,
  sliceKey: string | undefined
): Prisma.work_itemsWhereInput {
  if (sliceKey === undefined) {
    return {};
  }
  const column = chartRollupGroupColumn(labelField);
  const isNull = sliceKey === CHART_SERIES_NULL_SLICE_KEY;
  switch (column) {
    case 'assignee_id':
      return { assignee_id: isNull ? null : sliceKey };
    case 'project_id':
      return { project_id: sliceKey };
    case 'status':
      return { status: sliceKey as WorkItemStatus };
    case 'status_category':
      return { status_category: sliceKey };
    case 'state_id':
      return { state_id: sliceKey };
    case 'type':
      return { type: sliceKey as WorkItemType };
    case 'priority':
      return { priority: sliceKey as WorkItemPriority };
  }
}

function humanizeStateId(stateId: string): string {
  return stateId
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

function workflowStateNameById(workflowConfig: unknown): Map<string, string> {
  const envelope = parseWorkflowConfigEnvelope(workflowConfig);
  const names = new Map<string, string>();
  if (!envelope) {
    return names;
  }
  for (const workflow of envelope.workflows) {
    for (const state of workflow.graph.states) {
      if (!names.has(state.id)) {
        names.set(state.id, state.name);
      }
    }
  }
  return names;
}

type ChartDimensionFilterQuery = {
  readonly status?: WorkItemStatus;
  readonly type?: WorkItemType;
  readonly priority?: WorkItemPriority;
  readonly assigneeId?: string;
};

function dimensionFilterFields(query: ChartDimensionFilterQuery): {
  status?: WorkItemStatus;
  type?: WorkItemType;
  priority?: WorkItemPriority;
  assignee_id?: string | null;
} {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assigneeId !== undefined
      ? {
          assignee_id:
            query.assigneeId === CHART_SERIES_NULL_SLICE_KEY
              ? null
              : query.assigneeId,
        }
      : {}),
  };
}

function dimensionFiltersWhere(
  query: ChartDimensionFilterQuery
): Prisma.work_item_chart_rollupsWhereInput & Prisma.work_itemsWhereInput {
  return dimensionFilterFields(query);
}

function dimensionKey(value: string | null | undefined): string {
  return value ?? CHART_SERIES_NULL_SLICE_KEY;
}

function projectIdWhere(projectIds: readonly string[]): { in: string[] } {
  return { in: [...projectIds] };
}

/** Series/drilldown query after service resolves accessible project scope. */
export type ChartAnalyticsScopedQuery = {
  readonly projectIds: readonly string[];
  readonly labelField: ChartSeriesLabelField;
  readonly from?: string;
  readonly to?: string;
  readonly sprintId?: string;
  readonly status?: WorkItemStatus;
  readonly type?: WorkItemType;
  readonly priority?: WorkItemPriority;
  readonly assigneeId?: string;
};

export type ChartDrilldownScopedQuery = ChartAnalyticsScopedQuery & {
  readonly sliceKey?: string;
  readonly page: number;
  readonly limit: number;
};

/** Hierarchy series/drilldown after service resolves accessible project scope. */
export type ChartHierarchyScopedQuery = {
  readonly projectIds: readonly string[];
  readonly measure: ChartHierarchyMeasure;
  /** Dig root: ring 0 = direct children of this work item. */
  readonly rootWorkItemId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly sprintId?: string;
  readonly status?: WorkItemStatus;
  readonly type?: WorkItemType;
  readonly priority?: WorkItemPriority;
  readonly assigneeId?: string;
};

export type ChartHierarchyDrilldownScopedQuery = ChartHierarchyScopedQuery & {
  readonly ring?: ChartHierarchyRingLevel;
  readonly sliceKey?: string;
  readonly parentKey?: string;
  readonly page: number;
  readonly limit: number;
};

type HierarchyRollupRow = {
  work_item_id: string;
  parent_id: string | null;
  item_count: number;
  story_points: number;
};

function hierarchyMeasureValue(
  row: HierarchyRollupRow,
  measure: ChartHierarchyMeasure
): number {
  return measure === 'story_points' ? row.story_points : row.item_count;
}

function emptyHierarchySeries(): {
  rings: ChartHierarchyRing[];
  totalValue: number;
} {
  return {
    rings: Array.from({ length: CHART_HIERARCHY_MAX_DEPTH }, (_, level) => ({
      level: level as ChartHierarchyRingLevel,
      slices: [],
    })),
    totalValue: 0,
  };
}

function emptyDrilldownPage(
  page: number,
  limit: number
): {
  workItems: ChartDrilldownItemRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  return {
    workItems: [],
    ...paginationMeta(0, page, limit),
  };
}

/**
 * Build nested series up to {@link CHART_HIERARCHY_MAX_DEPTH} rings.
 * Without `rootWorkItemId`: promoted roots in scope.
 * With dig root: ring 0 = that node's direct children (disk-analyzer style).
 */
export function buildHierarchyRings(
  rows: readonly HierarchyRollupRow[],
  titleById: ReadonlyMap<string, string>,
  measure: ChartHierarchyMeasure,
  rootWorkItemId?: string
): { rings: ChartHierarchyRing[]; totalValue: number } {
  const idsInScope = new Set(rows.map((row) => row.work_item_id));
  const byParent = new Map<string, HierarchyRollupRow[]>();
  for (const row of rows) {
    if (row.parent_id == null || !idsInScope.has(row.parent_id)) {
      continue;
    }
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const toSlice = (
    row: HierarchyRollupRow,
    parentKey?: string
  ): ChartHierarchySlice => {
    const slice: ChartHierarchySlice = {
      key: row.work_item_id,
      label: titleById.get(row.work_item_id) ?? row.work_item_id,
      value: hierarchyMeasureValue(row, measure),
      hasChildren: (byParent.get(row.work_item_id)?.length ?? 0) > 0,
    };
    if (parentKey) {
      return { ...slice, parentKey };
    }
    return slice;
  };

  const sortByValueDesc = (a: ChartHierarchySlice, b: ChartHierarchySlice) =>
    b.value - a.value || a.label.localeCompare(b.label);

  const roots = rootWorkItemId
    ? (byParent.get(rootWorkItemId) ?? [])
    : rows.filter(
        (row) => row.parent_id == null || !idsInScope.has(row.parent_id)
      );

  const rings: ChartHierarchyRing[] = [];
  let previousIds = new Set(roots.map((row) => row.work_item_id));

  rings.push({
    level: 0,
    slices: roots
      .map((row) => toSlice(row, rootWorkItemId))
      .sort(sortByValueDesc),
  });

  for (let level = 1; level < CHART_HIERARCHY_MAX_DEPTH; level += 1) {
    const levelRows: HierarchyRollupRow[] = [];
    for (const parentId of previousIds) {
      const children = byParent.get(parentId);
      if (children) {
        levelRows.push(...children);
      }
    }
    rings.push({
      level: level as ChartHierarchyRingLevel,
      slices: levelRows
        .map((row) => toSlice(row, row.parent_id ?? undefined))
        .sort(sortByValueDesc),
    });
    previousIds = new Set(levelRows.map((row) => row.work_item_id));
  }

  const innerSlices = rings[0]?.slices ?? [];
  return {
    rings,
    totalValue: innerSlices.reduce((sum, slice) => sum + slice.value, 0),
  };
}

export class ChartsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async sumSeries(query: ChartAnalyticsScopedQuery): Promise<{
    slices: ChartSeriesSlice[];
    totalCount: number;
  }> {
    if (query.projectIds.length === 0) {
      return { slices: [], totalCount: 0 };
    }

    const column = chartRollupGroupColumn(query.labelField);
    const bucket_date = bucketDateWhere(query.from, query.to);
    const grouped = await prisma.work_item_chart_rollups.groupBy({
      by: [column],
      where: {
        project_id: projectIdWhere(query.projectIds),
        ...(query.sprintId ? { sprint_id: query.sprintId } : {}),
        ...(bucket_date ? { bucket_date } : {}),
        ...dimensionFiltersWhere(query),
      },
      _sum: { item_count: true },
      orderBy: { _sum: { item_count: 'desc' } },
    });

    const rawSlices = grouped.map((row) => {
      const raw = row[column] as string | null;
      const count = row._sum.item_count ?? 0;
      const key = dimensionKey(raw);
      return { key, label: key || 'Unassigned', count };
    });

    const labeled = await this.enrichSeriesLabels(
      query.labelField,
      rawSlices,
      query.projectIds
    );
    const totalCount = labeled.reduce((sum, slice) => sum + slice.count, 0);
    return { slices: labeled, totalCount };
  }

  async listDrilldown(query: ChartDrilldownScopedQuery): Promise<{
    workItems: ChartDrilldownItemRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (query.projectIds.length === 0) {
      return emptyDrilldownPage(query.page, query.limit);
    }

    const created_at = createdAtWhere(query.from, query.to);
    const where: Prisma.work_itemsWhereInput = {
      project_id: projectIdWhere(query.projectIds),
      record_status: RecordStatus.active,
      ...(query.sprintId ? { sprint_id: query.sprintId } : {}),
      ...(created_at ? { created_at } : {}),
      ...dimensionFiltersWhere(query),
      ...sliceDimensionWhere(query.labelField, query.sliceKey),
    };

    return this.fetchDrilldownPage(where, query.page, query.limit);
  }

  async sumHierarchySeries(query: ChartHierarchyScopedQuery): Promise<{
    rings: ChartHierarchyRing[];
    totalValue: number;
  }> {
    if (query.projectIds.length === 0) {
      return emptyHierarchySeries();
    }

    const rows = await this.listHierarchyRows(query);
    if (rows.length === 0) {
      return emptyHierarchySeries();
    }

    const titleById = await this.loadWorkItemTitles(
      rows.map((row) => row.work_item_id)
    );
    return buildHierarchyRings(
      rows,
      titleById,
      query.measure,
      query.rootWorkItemId
    );
  }

  async listHierarchyDrilldown(
    query: ChartHierarchyDrilldownScopedQuery
  ): Promise<{
    workItems: ChartDrilldownItemRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    if (query.projectIds.length === 0) {
      return emptyDrilldownPage(query.page, query.limit);
    }

    const rows = await this.listHierarchyRows(query);
    const scopedIds = this.resolveHierarchyDrilldownIds(rows, query);
    if (scopedIds.length === 0) {
      return emptyDrilldownPage(query.page, query.limit);
    }

    return this.fetchDrilldownPage(
      {
        id: { in: scopedIds },
        record_status: RecordStatus.active,
      },
      query.page,
      query.limit
    );
  }

  private async fetchDrilldownPage(
    where: Prisma.work_itemsWhereInput,
    page: number,
    limit: number
  ): Promise<{
    workItems: ChartDrilldownItemRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const [workItems, totalCount] = await Promise.all([
      prisma.work_items.findMany({
        where,
        select: chartDrilldownItemSelect,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.work_items.count({ where }),
    ]);

    return {
      workItems: workItems as ChartDrilldownItemRow[],
      ...paginationMeta(totalCount, page, limit),
    };
  }

  private resolveHierarchyDrilldownIds(
    rows: readonly HierarchyRollupRow[],
    query: ChartHierarchyDrilldownScopedQuery
  ): string[] {
    if (query.sliceKey === undefined || query.ring === undefined) {
      return rows.map((row) => row.work_item_id);
    }

    if (query.ring === 0) {
      return rows
        .filter((row) => row.work_item_id === query.sliceKey)
        .map((row) => row.work_item_id);
    }

    return rows
      .filter((row) => {
        if (row.work_item_id !== query.sliceKey) {
          return false;
        }
        if (query.parentKey && row.parent_id !== query.parentKey) {
          return false;
        }
        return true;
      })
      .map((row) => row.work_item_id);
  }

  private listHierarchyRows(
    query: ChartHierarchyScopedQuery
  ): Promise<HierarchyRollupRow[]> {
    const bucket_date = bucketDateWhere(query.from, query.to);
    return prisma.work_item_chart_hierarchy_rollups.findMany({
      where: {
        project_id: projectIdWhere(query.projectIds),
        ...(query.sprintId ? { sprint_id: query.sprintId } : {}),
        ...(bucket_date ? { bucket_date } : {}),
        ...dimensionFilterFields(query),
      },
      select: {
        work_item_id: true,
        parent_id: true,
        item_count: true,
        story_points: true,
      },
    });
  }

  private async loadWorkItemTitles(
    workItemIds: readonly string[]
  ): Promise<Map<string, string>> {
    if (workItemIds.length === 0) {
      return new Map();
    }
    const items = await prisma.work_items.findMany({
      where: { id: { in: [...workItemIds] } },
      select: { id: true, title: true },
    });
    return new Map(items.map((item) => [item.id, item.title]));
  }

  private async enrichSeriesLabels(
    labelField: ChartSeriesLabelField,
    slices: ChartSeriesSlice[],
    projectIds: readonly string[]
  ): Promise<ChartSeriesSlice[]> {
    if (labelField === 'category') {
      return slices.map((slice) => ({
        ...slice,
        label:
          slice.key === CHART_SERIES_NULL_SLICE_KEY
            ? 'Unknown'
            : chartCategoryDisplayLabel(slice.key),
      }));
    }

    if (labelField === 'state') {
      const projectId = projectIds.length === 1 ? projectIds[0] : null;
      let nameById = new Map<string, string>();
      if (projectId) {
        const project = await prisma.projects.findUnique({
          where: { id: projectId },
          select: { workflow_config: true },
        });
        nameById = workflowStateNameById(project?.workflow_config);
      }
      return slices.map((slice) => ({
        ...slice,
        label:
          slice.key === CHART_SERIES_NULL_SLICE_KEY
            ? 'Unknown'
            : (nameById.get(slice.key) ?? humanizeStateId(slice.key)),
      }));
    }

    if (labelField === 'board') {
      const boardProjectIds = slices
        .map((slice) => slice.key)
        .filter((key) => key !== CHART_SERIES_NULL_SLICE_KEY);
      if (boardProjectIds.length === 0) {
        return slices.map((slice) => ({
          ...slice,
          label: 'Unknown project',
        }));
      }

      const projects = await prisma.projects.findMany({
        where: { id: { in: boardProjectIds } },
        select: { id: true, name: true, key: true },
      });
      const labelById = new Map(
        projects.map((project) => [
          project.id,
          `${project.key} — ${project.name}`,
        ])
      );

      return slices.map((slice) => ({
        ...slice,
        label: slice.key
          ? (labelById.get(slice.key) ?? slice.key)
          : 'Unknown project',
      }));
    }

    if (labelField !== 'owner') {
      return slices.map((slice) => ({
        ...slice,
        label:
          slice.key === CHART_SERIES_NULL_SLICE_KEY ? 'Unassigned' : slice.key,
      }));
    }

    const assigneeIds = slices
      .map((slice) => slice.key)
      .filter((key) => key !== CHART_SERIES_NULL_SLICE_KEY);
    if (assigneeIds.length === 0) {
      return slices.map((slice) => ({
        ...slice,
        label: 'Unassigned',
      }));
    }

    const users = await prisma.users.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, email: true },
    });
    const nameById = new Map(
      users.map((user) => [user.id, user.name || user.email || user.id])
    );

    return slices.map((slice) => ({
      ...slice,
      label:
        slice.key === CHART_SERIES_NULL_SLICE_KEY
          ? 'Unassigned'
          : (nameById.get(slice.key) ?? slice.key),
    }));
  }

  async create(ownerId: string, input: CreateChartBody): Promise<ChartRow> {
    const created = await prisma.charts.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        board_json: toPrismaBoardJson(input.board_json),
        show_on_dashboard: input.show_on_dashboard ?? false,
        dashboard_sort_order: input.dashboard_sort_order ?? 0,
        ...prismaAuditCreate(ownerId),
      },
    });
    return toChartRow(created);
  }

  async getById(chartId: string): Promise<ChartRow | null> {
    const row = await prisma.charts.findUnique({ where: { id: chartId } });
    return row ? toChartRow(row) : null;
  }

  async listOwned(
    ownerId: string,
    status?: 'active' | 'archived'
  ): Promise<ChartRow[]> {
    const rows = await prisma.charts.findMany({
      where: {
        owner_id: ownerId,
        ...(status ? { status } : { status: { in: ['active', 'archived'] } }),
      },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map(toChartRow);
  }

  async listSharedWithMe(userId: string): Promise<ChartRow[]> {
    const shares = await prisma.chart_shares.findMany({
      where: { user_id: userId, status: RecordStatus.active },
      include: { chart: true },
      orderBy: { updated_at: 'desc' },
    });
    return shares
      .filter((share) => share.chart.status === RecordStatus.active)
      .map((share) => toChartRow(share.chart));
  }

  /**
   * Owned ∪ shared-accessible active charts pinned to the Dashboard slider.
   */
  async listDashboardSlides(userId: string): Promise<ChartRow[]> {
    const [owned, shared] = await Promise.all([
      prisma.charts.findMany({
        where: {
          owner_id: userId,
          status: RecordStatus.active,
          show_on_dashboard: true,
        },
      }),
      prisma.chart_shares.findMany({
        where: { user_id: userId, status: RecordStatus.active },
        include: { chart: true },
      }),
    ]);

    const byId = new Map<string, ChartRow>();
    for (const row of owned) {
      byId.set(row.id, toChartRow(row));
    }
    for (const share of shared) {
      if (
        share.chart.status === RecordStatus.active &&
        share.chart.show_on_dashboard
      ) {
        byId.set(share.chart.id, toChartRow(share.chart));
      }
    }

    return [...byId.values()].sort((left, right) => {
      if (left.dashboard_sort_order !== right.dashboard_sort_order) {
        return left.dashboard_sort_order - right.dashboard_sort_order;
      }
      return left.title.localeCompare(right.title);
    });
  }

  async update(
    chartId: string,
    actorId: string,
    input: UpdateChartBody
  ): Promise<ChartRow> {
    const updated = await prisma.charts.update({
      where: { id: chartId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.board_json !== undefined
          ? { board_json: toPrismaBoardJson(input.board_json) }
          : {}),
        ...(input.show_on_dashboard !== undefined
          ? { show_on_dashboard: input.show_on_dashboard }
          : {}),
        ...(input.dashboard_sort_order !== undefined
          ? { dashboard_sort_order: input.dashboard_sort_order }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...prismaAuditUpdate(actorId),
      },
    });
    return toChartRow(updated);
  }

  async setStatus(
    chartId: string,
    actorId: string,
    status: 'active' | 'archived'
  ): Promise<ChartRow> {
    const updated = await prisma.charts.update({
      where: { id: chartId },
      data: {
        status,
        ...(status === 'archived' ? { show_on_dashboard: false } : {}),
        ...prismaAuditUpdate(actorId),
      },
    });
    return toChartRow(updated);
  }

  async fork(params: {
    readonly sourceChartId: string;
    readonly actorId: string;
    readonly title?: string;
  }): Promise<ChartRow> {
    const source = await this.getById(params.sourceChartId);
    if (!source) {
      throw new Error('Chart not found');
    }
    const created = await prisma.charts.create({
      data: {
        owner_id: params.actorId,
        title: params.title?.trim() || `${source.title} (copy)`,
        description: source.description,
        board_json: toPrismaBoardJson(
          source.board_json as CreateChartBody['board_json']
        ),
        show_on_dashboard: false,
        dashboard_sort_order: 0,
        ...prismaAuditCreate(params.actorId),
      },
    });
    return toChartRow(created);
  }

  async hardDelete(chartId: string): Promise<void> {
    await prisma.charts.delete({ where: { id: chartId } });
  }

  async listActiveShareUserIds(chartId: string): Promise<string[]> {
    const rows = await prisma.chart_shares.findMany({
      where: { chart_id: chartId, status: RecordStatus.active },
      select: { user_id: true },
    });
    return rows.map((row) => row.user_id);
  }

  async upsertShares(params: {
    readonly chartId: string;
    readonly actorId: string;
    readonly userIds: readonly string[];
  }): Promise<void> {
    await Promise.all(
      params.userIds.map((userId) =>
        prisma.chart_shares.upsert({
          where: {
            chart_id_user_id: {
              chart_id: params.chartId,
              user_id: userId,
            },
          },
          create: {
            chart_id: params.chartId,
            user_id: userId,
            ...prismaAuditCreate(params.actorId),
          },
          update: {
            status: RecordStatus.active,
            ...prismaAuditUpdate(params.actorId),
          },
        })
      )
    );
  }

  async deleteShare(params: {
    readonly chartId: string;
    readonly userId: string;
  }): Promise<void> {
    await prisma.chart_shares.deleteMany({
      where: { chart_id: params.chartId, user_id: params.userId },
    });
  }
}
