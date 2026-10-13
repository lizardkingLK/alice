import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartsService } from '../../src/routes/api/charts/charts.service';

const {
  listDashboardSlidesMock,
  getByIdMock,
  listActiveShareUserIdsMock,
  forkMock,
} = vi.hoisted(() => ({
  listDashboardSlidesMock: vi.fn(),
  getByIdMock: vi.fn(),
  listActiveShareUserIdsMock: vi.fn(),
  forkMock: vi.fn(),
}));

const chartsRepository = {
  listDashboardSlides: listDashboardSlidesMock,
  getById: getByIdMock,
  listActiveShareUserIds: listActiveShareUserIdsMock,
  fork: forkMock,
} as never;

const service = new ChartsService(chartsRepository, {} as never);

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VIEWER_ID = '33333333-3333-4333-8333-333333333333';
const CHART_ID = '22222222-2222-4222-8222-222222222222';

describe('ChartsService dashboard + fork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists dashboard slides', async () => {
    listDashboardSlidesMock.mockResolvedValue([
      {
        id: CHART_ID,
        show_on_dashboard: true,
        dashboard_sort_order: 1,
      },
    ]);
    const rows = await service.listDashboardSlides(VIEWER_ID);
    expect(listDashboardSlidesMock).toHaveBeenCalledWith(VIEWER_ID);
    expect(rows).toHaveLength(1);
  });

  it('forks a shared chart for the viewer', async () => {
    getByIdMock.mockResolvedValue({
      id: CHART_ID,
      owner_id: OWNER_ID,
      title: 'Shared board',
      description: null,
      board_json: { instances: [], layout: [] },
      show_on_dashboard: true,
      dashboard_sort_order: 0,
      status: 'active',
    });
    listActiveShareUserIdsMock.mockResolvedValue([VIEWER_ID]);
    forkMock.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      owner_id: VIEWER_ID,
      title: 'Shared board (copy)',
      show_on_dashboard: false,
      dashboard_sort_order: 0,
      status: 'active',
    });

    const forked = await service.fork(VIEWER_ID, CHART_ID);
    expect(forkMock).toHaveBeenCalledWith({
      sourceChartId: CHART_ID,
      actorId: VIEWER_ID,
    });
    expect(forked.owner_id).toBe(VIEWER_ID);
  });

  it('rejects forking your own chart', async () => {
    getByIdMock.mockResolvedValue({
      id: CHART_ID,
      owner_id: OWNER_ID,
      title: 'Mine',
      status: 'active',
    });
    await expect(service.fork(OWNER_ID, CHART_ID)).rejects.toThrow(
      'Cannot fork your own chart'
    );
    expect(forkMock).not.toHaveBeenCalled();
  });
});
