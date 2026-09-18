import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartSeriesQuery } from '@repo/types';
import { ChartsService } from '../../src/routes/api/charts/charts.service';
import type { ChartsRepository } from '../../src/routes/api/charts/charts.repository';
import type { NotificationsRepository } from '../../src/routes/api/notifications/notifications.repository';
import type { SavedViewsRepository } from '../../src/routes/api/savedViews/savedViews.repository';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { listAccessibleProjectIdsMock, sumSeriesMock, listDrilldownMock } =
  vi.hoisted(() => ({
    listAccessibleProjectIdsMock: vi.fn(),
    sumSeriesMock: vi.fn(),
    listDrilldownMock: vi.fn(),
  }));

const chartsRepository = {
  listAccessibleProjectIds: listAccessibleProjectIdsMock,
  sumSeries: sumSeriesMock,
  listDrilldown: listDrilldownMock,
} as unknown as ChartsRepository;

const service = new ChartsService(
  chartsRepository,
  {} as NotificationsRepository,
  {} as SavedViewsRepository
);

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

const seriesQuery: ChartSeriesQuery = {
  projectId: PROJECT_ID,
  labelField: 'status',
};

describe('ChartsService analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([PROJECT_ID]);
  });

  it('returns series after project ACL check', async () => {
    sumSeriesMock.mockResolvedValue({
      slices: [{ key: 'New', label: 'New', count: 2 }],
      totalCount: 2,
    });

    await expect(service.getSeries('user-1', seriesQuery)).resolves.toEqual({
      projectId: PROJECT_ID,
      labelField: 'status',
      slices: [{ key: 'New', label: 'New', count: 2 }],
      totalCount: 2,
    });
    expect(listAccessibleProjectIdsMock).toHaveBeenCalledWith('user-1');
    expect(sumSeriesMock).toHaveBeenCalledWith(seriesQuery);
  });

  it('forbids series when project is not accessible', async () => {
    listAccessibleProjectIdsMock.mockResolvedValue([]);

    await expect(service.getSeries('user-1', seriesQuery)).rejects.toThrow(
      'Forbidden'
    );
    expect(sumSeriesMock).not.toHaveBeenCalled();
  });

  it('returns drilldown after project ACL check', async () => {
    const row = createWorkItemListRow();
    listDrilldownMock.mockResolvedValue({
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const query = {
      ...seriesQuery,
      sliceKey: 'New',
      page: 1,
      limit: 20,
    };

    await expect(service.getDrilldown('user-1', query)).resolves.toEqual({
      projectId: PROJECT_ID,
      labelField: 'status',
      sliceKey: 'New',
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(listDrilldownMock).toHaveBeenCalledWith(query);
  });
});
