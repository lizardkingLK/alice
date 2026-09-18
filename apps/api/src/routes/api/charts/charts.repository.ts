import type { CreateChartBody, UpdateChartBody } from './charts.schemas';
import {
  chartDrilldownItemSelect,
  chartRollupGroupColumn,
  CHART_SERIES_NULL_SLICE_KEY,
  paginationMeta,
  type ChartDrilldownQuery,
  type ChartSeriesLabelField,
  type ChartSeriesQuery,
  type ChartSeriesSlice,
  type Database,
  type WorkItemListRow,
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
  is_overview: boolean;
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
  is_overview: boolean;
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
    is_overview: row.is_overview,
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
  sliceKey: string
): Prisma.work_itemsWhereInput {
  const column = chartRollupGroupColumn(labelField);
  const isNull = sliceKey === CHART_SERIES_NULL_SLICE_KEY;
  switch (column) {
    case 'assignee_id':
      return { assignee_id: isNull ? null : sliceKey };
    case 'project_id':
      return { project_id: sliceKey };
    case 'status':
      return { status: sliceKey as WorkItemStatus };
    case 'type':
      return { type: sliceKey as WorkItemType };
    case 'priority':
      return { priority: sliceKey as WorkItemPriority };
  }
}

function dimensionKey(value: string | null | undefined): string {
  return value ?? CHART_SERIES_NULL_SLICE_KEY;
}

export class ChartsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async sumSeries(query: ChartSeriesQuery): Promise<{
    slices: ChartSeriesSlice[];
    totalCount: number;
  }> {
    const column = chartRollupGroupColumn(query.labelField);
    const bucket_date = bucketDateWhere(query.from, query.to);
    const grouped = await prisma.work_item_chart_rollups.groupBy({
      by: [column],
      where: {
        project_id: query.projectId,
        ...(query.sprintId ? { sprint_id: query.sprintId } : {}),
        ...(bucket_date ? { bucket_date } : {}),
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
      query.projectId,
      rawSlices
    );
    const totalCount = labeled.reduce((sum, slice) => sum + slice.count, 0);
    return { slices: labeled, totalCount };
  }

  async listDrilldown(query: ChartDrilldownQuery): Promise<{
    workItems: WorkItemListRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const created_at = createdAtWhere(query.from, query.to);
    const where: Prisma.work_itemsWhereInput = {
      project_id: query.projectId,
      record_status: RecordStatus.active,
      ...(query.sprintId ? { sprint_id: query.sprintId } : {}),
      ...(created_at ? { created_at } : {}),
      ...sliceDimensionWhere(query.labelField, query.sliceKey),
    };

    const skip = (query.page - 1) * query.limit;
    const [workItems, totalCount] = await Promise.all([
      prisma.work_items.findMany({
        where,
        select: chartDrilldownItemSelect,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: query.limit,
      }),
      prisma.work_items.count({ where }),
    ]);

    return {
      workItems: workItems as WorkItemListRow[],
      ...paginationMeta(totalCount, query.page, query.limit),
    };
  }

  private async enrichSeriesLabels(
    labelField: ChartSeriesLabelField,
    projectId: string,
    slices: ChartSeriesSlice[]
  ): Promise<ChartSeriesSlice[]> {
    if (labelField === 'board') {
      const project = await prisma.projects.findUnique({
        where: { id: projectId },
        select: { name: true, key: true },
      });
      const label = project ? `${project.key} — ${project.name}` : projectId;
      return slices.map((slice) => ({
        ...slice,
        label: slice.key ? label : 'Unknown project',
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
    if (input.is_overview) {
      await this.clearOverviewFlag(ownerId);
    }

    const created = await prisma.charts.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        owner_id: ownerId,
        title: input.title,
        description: input.description ?? null,
        board_json: toPrismaBoardJson(input.board_json),
        is_overview: input.is_overview ?? false,
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

  async update(
    chartId: string,
    actorId: string,
    input: UpdateChartBody
  ): Promise<ChartRow> {
    if (input.is_overview === true) {
      const existing = await this.getById(chartId);
      if (existing) {
        await this.clearOverviewFlag(existing.owner_id, chartId);
      }
    }

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
        ...(input.is_overview !== undefined
          ? { is_overview: input.is_overview }
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
        ...(status === 'archived' ? { is_overview: false } : {}),
        ...prismaAuditUpdate(actorId),
      },
    });
    return toChartRow(updated);
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
    for (const userId of params.userIds) {
      await prisma.chart_shares.upsert({
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
      });
    }
  }

  async deleteShare(params: {
    readonly chartId: string;
    readonly userId: string;
  }): Promise<void> {
    await prisma.chart_shares.deleteMany({
      where: { chart_id: params.chartId, user_id: params.userId },
    });
  }

  private async clearOverviewFlag(
    ownerId: string,
    exceptChartId?: string
  ): Promise<void> {
    await prisma.charts.updateMany({
      where: {
        owner_id: ownerId,
        is_overview: true,
        ...(exceptChartId ? { id: { not: exceptChartId } } : {}),
      },
      data: { is_overview: false },
    });
  }
}
