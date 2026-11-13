import {
  buildSprintContributionGroups,
  ChartSharedNotification,
  clampContributionAsOf,
  groupsFromSprintContributionRollupRows,
  NotificationBuilder,
  type ChartDrilldownQuery,
  type ChartDrilldownResponse,
  type ChartHierarchyDrilldownQuery,
  type ChartHierarchyDrilldownResponse,
  type ChartHierarchySeriesQuery,
  type ChartHierarchySeriesResponse,
  type ChartSeriesQuery,
  type ChartSeriesResponse,
  type ChartSprintContributionQuery,
  type ChartSprintContributionResponse,
  type SprintContributionGroup,
} from '@repo/types';
import { enqueueDestructiveAction } from '../../../lib/enqueue-destructive-action';
import type { NotificationsRepository } from '../notifications/notifications.repository';
import { ChartsRepository, type ChartRow } from './charts.repository';
import type {
  CreateChartBody,
  ShareChartBody,
  UpdateChartBody,
} from './charts.schemas';

/** Empty string = unassigned bucket; omit = all members. */
function resolveContributionAssigneeFilter(
  assigneeId: string | undefined
): string | null | undefined {
  if (assigneeId === undefined) {
    return undefined;
  }
  if (assigneeId === '') {
    return null;
  }
  return assigneeId;
}

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

  /**
   * Validate sync, accept archive, finish in the background, inbox-notify.
   * Interim until BullMQ owns destructive jobs.
   */
  async enqueueArchive(
    actorId: string,
    chartId: string
  ): Promise<{ readonly correlationId: string; readonly message: string }> {
    const chart = await this.requireOwned(actorId, chartId);
    return enqueueDestructiveAction({
      actorId,
      kind: 'archive',
      entityType: 'chart',
      entityLabel: chart.title,
      relatedItemId: chartId,
      detailHref: `/charts/${chartId}`,
      run: async () => {
        await this.archive(actorId, chartId);
      },
    });
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
   * Validate sync, accept permanent delete, finish in the background,
   * inbox-notify. Interim until BullMQ owns destructive jobs.
   */
  async enqueueHardDelete(
    actorId: string,
    chartId: string
  ): Promise<{ readonly correlationId: string; readonly message: string }> {
    const chart = await this.requireOwned(actorId, chartId);
    return enqueueDestructiveAction({
      actorId,
      kind: 'purge',
      entityType: 'chart',
      entityLabel: chart.title,
      relatedItemId: null,
      detailHref: '/charts',
      run: async () => {
        await this.hardDelete(actorId, chartId);
      },
    });
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

  async getSprintContribution(
    actorId: string,
    query: ChartSprintContributionQuery
  ): Promise<ChartSprintContributionResponse> {
    await this.resolveProjectScope(actorId, query.projectId);

    const sprint = await this.chartsRepository.getSprintForContribution(
      query.sprintId
    );
    if (!sprint) {
      throw new Error('Sprint not found');
    }
    if (sprint.project_id !== query.projectId) {
      throw new Error('Sprint not found');
    }

    const today = new Date().toISOString().slice(0, 10);
    const asOf = clampContributionAsOf(
      query.asOf ?? today,
      sprint.start_date,
      sprint.end_date
    );

    const assigneeFilter = resolveContributionAssigneeFilter(query.assigneeId);

    const rollupRows = await this.chartsRepository.listSprintContributionRollup(
      query.sprintId
    );
    const rollupAsOf = rollupRows[0]?.as_of;
    const useRollup =
      rollupRows.length > 0 && rollupAsOf !== undefined && rollupAsOf === asOf;

    let groups: SprintContributionGroup[];
    if (useRollup) {
      const assigneeIds = [
        ...new Set(
          rollupRows
            .map((row) => row.assignee_id)
            .filter((id): id is string => typeof id === 'string')
        ),
      ];
      const assigneeNames =
        await this.chartsRepository.listUserDisplayNames(assigneeIds);
      groups = groupsFromSprintContributionRollupRows({
        rows: rollupRows.map((row) => ({
          assigneeId: row.assignee_id,
          group: row.group_id,
          estimatedPoints: row.estimated_points,
          loggedHours: row.logged_hours,
          itemCount: row.item_count,
          asOf: row.as_of,
        })),
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        asOf,
        assigneeNames,
        ...(assigneeFilter !== undefined ? { assigneeId: assigneeFilter } : {}),
      });
    } else {
      groups = await this.computeSprintContributionLive({
        sprintId: query.sprintId,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        asOf,
        assigneeFilter,
      });
      void this.chartsRepository.rebuildSprintAnalyticsRollup(query.sprintId);
    }

    return {
      projectId: query.projectId,
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
      asOf,
      ...(query.assigneeId !== undefined
        ? { assigneeId: query.assigneeId }
        : {}),
      groups,
    };
  }

  private async computeSprintContributionLive(params: {
    readonly sprintId: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly asOf: string;
    readonly assigneeFilter: string | null | undefined;
  }): Promise<SprintContributionGroup[]> {
    const items = await this.chartsRepository.listSprintContributionItems(
      params.sprintId
    );
    const workItemIds = items.map((item) => item.id);
    const logs =
      await this.chartsRepository.listSprintContributionWorklogs(workItemIds);

    const assigneeIds = [
      ...new Set(
        items
          .map((item) => item.assignee_id)
          .filter((id): id is string => typeof id === 'string')
      ),
    ];
    const assigneeNames =
      await this.chartsRepository.listUserDisplayNames(assigneeIds);

    return buildSprintContributionGroups({
      items: items.map((item) => ({
        id: item.id,
        assigneeId: item.assignee_id,
        storyPoints: item.story_points,
        isDone: item.status_category === 'done',
      })),
      logs: logs.map((log) => ({
        workItemId: log.work_item_id,
        loggedAt: log.logged_at,
        loggedHours: log.logged_hours,
      })),
      startDate: params.startDate,
      endDate: params.endDate,
      asOf: params.asOf,
      assigneeNames,
      ...(params.assigneeFilter !== undefined
        ? { assigneeId: params.assigneeFilter }
        : {}),
    });
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
