import {
  ChartSharedNotification,
  NotificationBuilder,
  type ChartDrilldownQuery,
  type ChartDrilldownResponse,
  type ChartHierarchyDrilldownQuery,
  type ChartHierarchyDrilldownResponse,
  type ChartHierarchySeriesQuery,
  type ChartHierarchySeriesResponse,
  type ChartSeriesQuery,
  type ChartSeriesResponse,
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
    this.assertStateLabelScope(query.labelField, responseProjectId);
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
    this.assertStateLabelScope(query.labelField, responseProjectId);
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

  async getHierarchySeries(
    actorId: string,
    query: ChartHierarchySeriesQuery
  ): Promise<ChartHierarchySeriesResponse> {
    const { responseProjectId, projectIds } = await this.resolveProjectScope(
      actorId,
      query.projectId
    );
    const dimensionFilters = this.pickDimensionFilters(query);
    const { rings, totalValue } =
      await this.chartsRepository.sumHierarchySeries({
        projectIds,
        measure: query.measure,
        ...dimensionFilters,
        ...(query.rootWorkItemId
          ? { rootWorkItemId: query.rootWorkItemId }
          : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
        ...(query.sprintId ? { sprintId: query.sprintId } : {}),
      });
    return {
      projectId: responseProjectId,
      measure: query.measure,
      rootWorkItemId: query.rootWorkItemId ?? null,
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.sprintId ? { sprintId: query.sprintId } : {}),
      rings,
      totalValue,
    };
  }

  async getHierarchyDrilldown(
    actorId: string,
    query: ChartHierarchyDrilldownQuery
  ): Promise<ChartHierarchyDrilldownResponse> {
    const { responseProjectId, projectIds } = await this.resolveProjectScope(
      actorId,
      query.projectId
    );
    const dimensionFilters = this.pickDimensionFilters(query);
    const page = await this.chartsRepository.listHierarchyDrilldown({
      projectIds,
      measure: query.measure,
      page: query.page,
      limit: query.limit,
      ...dimensionFilters,
      ...(query.ring !== undefined ? { ring: query.ring as 0 | 1 | 2 } : {}),
      ...(query.sliceKey !== undefined ? { sliceKey: query.sliceKey } : {}),
      ...(query.parentKey !== undefined ? { parentKey: query.parentKey } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.sprintId ? { sprintId: query.sprintId } : {}),
    });
    return {
      projectId: responseProjectId,
      measure: query.measure,
      ring: query.ring !== undefined ? (query.ring as 0 | 1 | 2) : null,
      sliceKey: query.sliceKey ?? '',
      parentKey: query.parentKey ?? '',
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
          show_on_dashboard: input.show_on_dashboard,
          dashboard_sort_order: input.dashboard_sort_order,
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

  listDashboardSlides(userId: string) {
    return this.chartsRepository.listDashboardSlides(userId);
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

  /**
   * Clone a shared (or accessible) chart under the viewer as owner.
   */
  async fork(actorId: string, chartId: string) {
    await this.getAccessible(actorId, chartId);
    const source = await this.chartsRepository.getById(chartId);
    if (!source) {
      throw new Error('Chart not found');
    }
    if (source.owner_id === actorId) {
      throw new Error('Cannot fork your own chart');
    }
    return this.chartsRepository.fork({
      sourceChartId: chartId,
      actorId,
    });
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

  private assertStateLabelScope(
    labelField: ChartSeriesQuery['labelField'],
    responseProjectId: string | null
  ): void {
    if (labelField === 'state' && !responseProjectId) {
      throw new Error('State series requires a single project filter');
    }
  }

  private pickDimensionFilters(
    query:
      | ChartSeriesQuery
      | ChartDrilldownQuery
      | ChartHierarchySeriesQuery
      | ChartHierarchyDrilldownQuery
  ): {
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
