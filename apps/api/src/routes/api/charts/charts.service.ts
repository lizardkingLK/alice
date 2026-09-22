import { ChartSharedNotification, NotificationBuilder } from '@repo/types';
import type {
  ChartDrilldownQuery,
  ChartDrilldownResponse,
  ChartSeriesQuery,
  ChartSeriesResponse,
} from '@repo/types';
import type { NotificationsRepository } from '../notifications/notifications.repository';
import { ChartsRepository, type ChartRow } from './charts.repository';
import type {
  CreateChartBody,
  ShareChartBody,
  UpdateChartBody,
} from './charts.schemas';

export class ChartsService {
  constructor(
    private readonly chartsRepository: ChartsRepository,
    private readonly notificationsRepository: NotificationsRepository
  ) {}

  async getSeries(
    actorId: string,
    query: ChartSeriesQuery
  ): Promise<ChartSeriesResponse> {
    const { responseProjectId, projectIds } = await this.resolveProjectScope(
      actorId,
      query.projectId
    );
    const dimensionFilters = this.pickDimensionFilters(query);
    const { slices, totalCount } = await this.chartsRepository.sumSeries({
      projectIds,
      labelField: query.labelField,
      ...dimensionFilters,
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.sprintId ? { sprintId: query.sprintId } : {}),
    });
    return {
      projectId: responseProjectId,
      labelField: query.labelField,
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.sprintId ? { sprintId: query.sprintId } : {}),
      slices,
      totalCount,
    };
  }

  async getDrilldown(
    actorId: string,
    query: ChartDrilldownQuery
  ): Promise<ChartDrilldownResponse> {
    const { responseProjectId, projectIds } = await this.resolveProjectScope(
      actorId,
      query.projectId
    );
    const dimensionFilters = this.pickDimensionFilters(query);
    const page = await this.chartsRepository.listDrilldown({
      projectIds,
      labelField: query.labelField,
      page: query.page,
      limit: query.limit,
      ...dimensionFilters,
      ...(query.sliceKey !== undefined ? { sliceKey: query.sliceKey } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.sprintId ? { sprintId: query.sprintId } : {}),
    });
    return {
      projectId: responseProjectId,
      labelField: query.labelField,
      sliceKey: query.sliceKey ?? '',
      ...page,
    };
  }

  async create(ownerId: string, input: CreateChartBody) {
    if (input.id) {
      const existing = await this.chartsRepository.getById(input.id);
      if (existing) {
        if (existing.owner_id !== ownerId) {
          throw new Error('Forbidden');
        }
        return this.chartsRepository.update(existing.id, ownerId, {
          title: input.title,
          description: input.description ?? null,
          board_json: input.board_json,
          is_overview: input.is_overview,
        });
      }
    }

    return this.chartsRepository.create(ownerId, input);
  }

  listOwned(ownerId: string, status?: 'active' | 'archived') {
    return this.chartsRepository.listOwned(ownerId, status);
  }

  listSharedWithMe(userId: string) {
    return this.chartsRepository.listSharedWithMe(userId);
  }

  async getAccessible(actorId: string, chartId: string): Promise<ChartRow> {
    const chart = await this.chartsRepository.getById(chartId);
    if (!chart) {
      throw new Error('Chart not found');
    }
    if (chart.owner_id === actorId) {
      return chart;
    }
    const shareIds =
      await this.chartsRepository.listActiveShareUserIds(chartId);
    if (!shareIds.includes(actorId) || chart.status !== 'active') {
      throw new Error('Forbidden');
    }
    return chart;
  }

  async update(actorId: string, chartId: string, input: UpdateChartBody) {
    const chart = await this.requireOwned(actorId, chartId);
    return this.chartsRepository.update(chart.id, actorId, input);
  }

  async archive(actorId: string, chartId: string) {
    await this.requireOwned(actorId, chartId);
    return this.chartsRepository.setStatus(chartId, actorId, 'archived');
  }

  async restore(actorId: string, chartId: string) {
    await this.requireOwned(actorId, chartId);
    return this.chartsRepository.setStatus(chartId, actorId, 'active');
  }

  async hardDelete(actorId: string, chartId: string) {
    await this.requireOwned(actorId, chartId);
    await this.chartsRepository.hardDelete(chartId);
  }

  /**
   * Low-level chart ACL used when a Views share targets a chart board.
   * Charts UI no longer exposes Share — prefer Views Save view → share.
   */
  async share(actorId: string, chartId: string, input: ShareChartBody) {
    const chart = await this.requireOwned(actorId, chartId);
    if (chart.status !== 'active') {
      throw new Error('Only active charts can be shared');
    }

    const existing = await this.chartsRepository.listActiveShareUserIds(
      chart.id
    );
    const nextIds = input.userIds.filter(
      (userId) => userId !== actorId && !existing.includes(userId)
    );

    if (nextIds.length > 0) {
      await this.chartsRepository.upsertShares({
        chartId: chart.id,
        actorId,
        userIds: nextIds,
      });
      await this.notifyRecipients({
        actorId,
        chart,
        recipientIds: nextIds,
      });
    }

    return {
      sharedCount: nextIds.length,
      chart,
    };
  }

  async deleteShare(actorId: string, chartId: string) {
    await this.chartsRepository.deleteShare({
      chartId,
      userId: actorId,
    });
  }

  private pickDimensionFilters(query: ChartSeriesQuery | ChartDrilldownQuery): {
    status: ChartSeriesQuery['status'];
    type: ChartSeriesQuery['type'];
    priority: ChartSeriesQuery['priority'];
    assigneeId: string | undefined;
  } {
    return {
      status: query.status,
      type: query.type,
      priority: query.priority,
      assigneeId: query.assigneeId,
    };
  }

  private async resolveProjectScope(
    actorId: string,
    projectId?: string
  ): Promise<{
    responseProjectId: string | null;
    projectIds: string[];
  }> {
    const accessible =
      await this.chartsRepository.listAccessibleProjectIds(actorId);

    if (projectId) {
      if (!accessible.includes(projectId)) {
        throw new Error('Forbidden');
      }
      return { responseProjectId: projectId, projectIds: [projectId] };
    }

    return { responseProjectId: null, projectIds: accessible };
  }

  private async requireOwned(actorId: string, chartId: string) {
    const chart = await this.chartsRepository.getById(chartId);
    if (!chart) {
      throw new Error('Chart not found');
    }
    if (chart.owner_id !== actorId) {
      throw new Error('Forbidden');
    }
    return chart;
  }

  private async notifyRecipients(params: {
    readonly actorId: string;
    readonly chart: ChartRow;
    readonly recipientIds: readonly string[];
  }) {
    if (params.recipientIds.length === 0) {
      return;
    }
    const message = `shared chart "${params.chart.title}" with you`;
    const rows = params.recipientIds.map((userId) =>
      new NotificationBuilder(ChartSharedNotification)
        .ToUser(userId)
        .WithMessage(message)
        .WithRelatedItem(params.chart.id)
        .WithCreatedBy(params.actorId)
        .WithUpdatedBy(params.actorId)
        .Build()
    );
    await this.notificationsRepository.insertMany(rows);
  }
}
