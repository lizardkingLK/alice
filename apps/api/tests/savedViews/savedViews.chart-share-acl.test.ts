import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveChartIdFromSavedView,
  SavedViewsService,
} from '../../src/routes/api/savedViews/savedViews.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '33333333-3333-4333-8333-333333333333';
const VIEW_ID = '44444444-4444-4444-8444-444444444444';
const CHART_ID = '22222222-2222-4222-8222-222222222222';

const {
  getByIdMock,
  upsertSharesMock,
  listActiveShareUserIdsMock,
  deleteShareMock,
  chartsUpsertSharesMock,
  chartsDeleteShareMock,
  getUserNameMock,
  insertManyMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  upsertSharesMock: vi.fn(),
  listActiveShareUserIdsMock: vi.fn(),
  deleteShareMock: vi.fn(),
  chartsUpsertSharesMock: vi.fn(),
  chartsDeleteShareMock: vi.fn(),
  getUserNameMock: vi.fn(),
  insertManyMock: vi.fn(),
}));

const savedViewsRepository = {
  getById: getByIdMock,
  upsertShares: upsertSharesMock,
  listActiveShareUserIds: listActiveShareUserIdsMock,
  deleteShare: deleteShareMock,
} as never;

const chartsRepository = {
  upsertShares: chartsUpsertSharesMock,
  deleteShare: chartsDeleteShareMock,
} as never;

const notificationsRepository = {
  getUserName: getUserNameMock,
  insertMany: insertManyMock,
} as never;

const service = new SavedViewsService(
  savedViewsRepository,
  notificationsRepository,
  chartsRepository
);

function chartView(overrides: Record<string, unknown> = {}) {
  return {
    id: VIEW_ID,
    owner_id: OWNER_ID,
    title: 'Sprint board',
    description: null,
    pathname: `/charts/${CHART_ID}`,
    search: '',
    project_id: null,
    status: 'active',
    resource_kind: 'chart',
    resource_id: CHART_ID,
    created_by: OWNER_ID,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: OWNER_ID,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveChartIdFromSavedView', () => {
  it('prefers typed resource_id for chart kind', () => {
    expect(
      resolveChartIdFromSavedView({
        resource_kind: 'chart',
        resource_id: CHART_ID,
        pathname: '/charts/other',
      })
    ).toBe(CHART_ID);
  });

  it('falls back to /charts/[uuid] pathname', () => {
    expect(
      resolveChartIdFromSavedView({
        resource_kind: 'page',
        resource_id: null,
        pathname: `/charts/${CHART_ID}`,
      })
    ).toBe(CHART_ID);
  });

  it('returns null when not a chart view', () => {
    expect(
      resolveChartIdFromSavedView({
        resource_kind: 'page',
        resource_id: null,
        pathname: '/board',
      })
    ).toBeNull();
  });
});

describe('SavedViewsService share chart ACL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listActiveShareUserIdsMock.mockResolvedValue([]);
    upsertSharesMock.mockResolvedValue(undefined);
    chartsUpsertSharesMock.mockResolvedValue(undefined);
    chartsDeleteShareMock.mockResolvedValue(undefined);
    deleteShareMock.mockResolvedValue(undefined);
    getUserNameMock.mockResolvedValue('Ada');
    insertManyMock.mockResolvedValue(undefined);
  });

  it('grants chart_shares when sharing a chart-backed view', async () => {
    getByIdMock.mockResolvedValue(chartView());

    await service.share(OWNER_ID, VIEW_ID, { userIds: [RECIPIENT_ID] });

    expect(chartsUpsertSharesMock).toHaveBeenCalledWith({
      chartId: CHART_ID,
      actorId: OWNER_ID,
      userIds: [RECIPIENT_ID],
    });
  });

  it('skips chart_shares for non-chart views', async () => {
    getByIdMock.mockResolvedValue(
      chartView({
        resource_kind: 'page',
        resource_id: null,
        pathname: '/board',
      })
    );

    await service.share(OWNER_ID, VIEW_ID, { userIds: [RECIPIENT_ID] });

    expect(chartsUpsertSharesMock).not.toHaveBeenCalled();
  });

  it('revokes chart_shares when recipient leaves a chart view', async () => {
    getByIdMock.mockResolvedValue(chartView());

    await service.deleteShare(RECIPIENT_ID, VIEW_ID);

    expect(deleteShareMock).toHaveBeenCalledWith({
      viewId: VIEW_ID,
      userId: RECIPIENT_ID,
    });
    expect(chartsDeleteShareMock).toHaveBeenCalledWith({
      chartId: CHART_ID,
      userId: RECIPIENT_ID,
    });
  });
});
