import { ChartSharedNotification, NotificationBuilder } from '@repo/types';
import type { NotificationsRepository } from '../notifications/notifications.repository';
import type { SavedViewsRepository } from '../savedViews/savedViews.repository';
import { ChartsRepository, type ChartRow } from './charts.repository';
import type {
  CreateChartBody,
  ShareChartBody,
  UpdateChartBody,
} from './charts.schemas';

export class ChartsService {
  constructor(
    private readonly chartsRepository: ChartsRepository,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly savedViewsRepository: SavedViewsRepository
  ) {}

  create(ownerId: string, input: CreateChartBody) {
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
    const chart = await this.requireOwned(actorId, chartId);
    if (chart.status !== 'archived') {
      throw new Error('Only archived charts can be permanently deleted');
    }
    await this.chartsRepository.hardDelete(chartId);
  }

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

    if (input.createSavedViewBookmark) {
      await this.savedViewsRepository.create(actorId, {
        title: chart.title,
        description: chart.description,
        pathname: `/charts/${chart.id}`,
        search: '',
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
