import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartsService } from '../../src/routes/api/charts/charts.service';

const { createMock, updateMock, getByIdMock, upsertChartBookmarkMock } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    updateMock: vi.fn(),
    getByIdMock: vi.fn(),
    upsertChartBookmarkMock: vi.fn(),
  }));

const chartsRepository = {
  create: createMock,
  update: updateMock,
  getById: getByIdMock,
} as never;

const savedViewsRepository = {
  upsertChartBookmark: upsertChartBookmarkMock,
} as never;

const service = new ChartsService(
  chartsRepository,
  {} as never,
  savedViewsRepository
);

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CHART_ID = '22222222-2222-4222-8222-222222222222';

describe('ChartsService create upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertChartBookmarkMock.mockResolvedValue({});
  });

  it('creates when id is new', async () => {
    getByIdMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: CHART_ID,
      owner_id: OWNER_ID,
      title: 'Woo',
      description: null,
      board_json: { instances: [], layout: [] },
      is_overview: false,
      status: 'active',
      created_by: OWNER_ID,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_by: OWNER_ID,
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    await service.create(OWNER_ID, {
      id: CHART_ID,
      title: 'Woo',
      board_json: { instances: [], layout: [] },
    });

    expect(createMock).toHaveBeenCalledOnce();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('updates board when id already owned by caller', async () => {
    getByIdMock.mockResolvedValue({
      id: CHART_ID,
      owner_id: OWNER_ID,
      title: 'Woo',
      description: null,
      board_json: { instances: [], layout: [] },
      is_overview: false,
      status: 'active',
      created_by: OWNER_ID,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_by: OWNER_ID,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    updateMock.mockResolvedValue({
      id: CHART_ID,
      owner_id: OWNER_ID,
      title: 'Woo',
      description: null,
      board_json: {
        instances: [{ instanceId: 'w1', typeId: 'chart' }],
        layout: [],
      },
      is_overview: false,
      status: 'active',
      created_by: OWNER_ID,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_by: OWNER_ID,
      updated_at: '2026-01-02T00:00:00.000Z',
    });

    await service.create(OWNER_ID, {
      id: CHART_ID,
      title: 'Woo',
      board_json: {
        instances: [{ instanceId: 'w1', typeId: 'chart' }],
        layout: [],
      },
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      CHART_ID,
      OWNER_ID,
      expect.objectContaining({
        title: 'Woo',
        board_json: expect.objectContaining({
          instances: [expect.objectContaining({ typeId: 'chart' })],
        }),
      })
    );
  });
});
