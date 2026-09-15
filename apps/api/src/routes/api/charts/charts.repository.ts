import type { CreateChartBody, UpdateChartBody } from './charts.schemas';
import { Prisma, RecordStatus } from '@repo/types/prisma';
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

export class ChartsRepository {
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
