import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock, findFirstMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    saved_views: {
      create: createMock,
      update: updateMock,
      findFirst: findFirstMock,
    },
  },
}));

import { SavedViewsRepository } from '../../src/routes/api/savedViews/savedViews.repository';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CHART_ID = '22222222-2222-4222-8222-222222222222';

describe('SavedViewsRepository upsertChartBookmark', () => {
  const repository = new SavedViewsRepository({} as SupabaseClient<Database>);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a typed chart bookmark when none exists', async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      owner_id: OWNER_ID,
      title: 'Sprint charts',
      description: null,
      pathname: `/charts/${CHART_ID}`,
      search: '',
      project_id: null,
      resource_kind: 'chart',
      resource_id: CHART_ID,
      status: 'active',
      created_by: OWNER_ID,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_by: OWNER_ID,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    const row = await repository.upsertChartBookmark(OWNER_ID, {
      id: CHART_ID,
      title: 'Sprint charts',
      description: null,
      status: 'active',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resource_kind: 'chart',
          resource_id: CHART_ID,
          pathname: `/charts/${CHART_ID}`,
          search: '',
          title: 'Sprint charts',
        }),
      })
    );
    expect(row.resource_kind).toBe('chart');
    expect(row.resource_id).toBe(CHART_ID);
  });

  it('archives an existing bookmark when the chart is archived', async () => {
    findFirstMock.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      owner_id: OWNER_ID,
      title: 'Old',
      description: null,
      pathname: `/charts/${CHART_ID}`,
      search: '',
      project_id: null,
      resource_kind: 'page',
      resource_id: null,
      status: 'active',
      created_by: OWNER_ID,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_by: OWNER_ID,
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    updateMock.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      owner_id: OWNER_ID,
      title: 'Sprint charts',
      description: null,
      pathname: `/charts/${CHART_ID}`,
      search: '',
      project_id: null,
      resource_kind: 'chart',
      resource_id: CHART_ID,
      status: 'archived',
      created_by: OWNER_ID,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_by: OWNER_ID,
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    });

    const row = await repository.upsertChartBookmark(OWNER_ID, {
      id: CHART_ID,
      title: 'Sprint charts',
      description: null,
      status: 'archived',
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resource_kind: 'chart',
          resource_id: CHART_ID,
          status: 'archived',
          title: 'Sprint charts',
        }),
      })
    );
    expect(row.status).toBe('archived');
  });
});
