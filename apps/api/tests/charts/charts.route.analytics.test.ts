import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChartsRouter } from '../../src/routes/api/charts/charts.route';
import type { ChartsService } from '../../src/routes/api/charts/charts.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { getSeriesMock, getDrilldownMock } = vi.hoisted(() => ({
  getSeriesMock: vi.fn(),
  getDrilldownMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

const chartsService = {
  getSeries: getSeriesMock,
  getDrilldown: getDrilldownMock,
} as unknown as ChartsService;

const chartsRouter = createChartsRouter({ chartsService });

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

describe('charts analytics routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns series for an accessible project', async () => {
    getSeriesMock.mockResolvedValue({
      projectId: PROJECT_ID,
      labelField: 'status',
      slices: [{ key: 'New', label: 'New', count: 2 }],
      totalCount: 2,
    });

    await withMountedRouter('/api/v1/charts', chartsRouter, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/v1/charts/analytics/series?projectId=${PROJECT_ID}&labelField=status`
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        data: {
          projectId: PROJECT_ID,
          labelField: 'status',
          slices: [{ key: 'New', label: 'New', count: 2 }],
          totalCount: 2,
        },
      });
      expect(getSeriesMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID, {
        projectId: PROJECT_ID,
        labelField: 'status',
      });
    });
  });

  it('rejects series without projectId', async () => {
    await withMountedRouter('/api/v1/charts', chartsRouter, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/v1/charts/analytics/series?labelField=status`
      );
      expect(response.status).toBe(400);
      expect(getSeriesMock).not.toHaveBeenCalled();
    });
  });

  it('returns paginated drilldown for a slice', async () => {
    const row = createWorkItemListRow();
    getDrilldownMock.mockResolvedValue({
      projectId: PROJECT_ID,
      labelField: 'owner',
      sliceKey: '',
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    await withMountedRouter('/api/v1/charts', chartsRouter, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/v1/charts/analytics/drilldown?projectId=${PROJECT_ID}&labelField=owner&sliceKey=`
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.sliceKey).toBe('');
      expect(body.data.workItems).toHaveLength(1);
      expect(getDrilldownMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID, {
        projectId: PROJECT_ID,
        labelField: 'owner',
        sliceKey: '',
        page: 1,
        limit: 20,
      });
    });
  });

  it('returns 403 when series service forbids access', async () => {
    getSeriesMock.mockRejectedValue(new Error('Forbidden'));

    await withMountedRouter('/api/v1/charts', chartsRouter, async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/v1/charts/analytics/series?projectId=${PROJECT_ID}`
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    });
  });
});
