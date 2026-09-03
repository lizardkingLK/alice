import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workItemFactory } from '../factories/workItem.factory';

const { shouldReadViaApiMock, apiFetchMock, createClientMock } = vi.hoisted(
  () => ({
    shouldReadViaApiMock: vi.fn(() => false),
    apiFetchMock: vi.fn(),
    createClientMock: vi.fn(),
  })
);

vi.mock('@/lib/data-retrieval.server', () => ({
  shouldReadViaApi: shouldReadViaApiMock,
}));

vi.mock('@/lib/api/api-fetch.reads.use.server', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import {
  getWorkItem,
  getWorkItemsPaginated,
} from '@/app/work-items/_services/work-items.reads.server';

function createPaginatedSupabase(
  row: ReturnType<typeof workItemFactory.build>
) {
  const range = vi.fn().mockResolvedValue({
    data: [row],
    error: null,
    count: 1,
  });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => ({ range })),
  };
  return {
    from: vi.fn(() => chain),
  };
}

function createDetailSupabase(row: ReturnType<typeof workItemFactory.build>) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  return {
    from: vi.fn(() => chain),
  };
}

describe('work-item server reads retrieval toggle', () => {
  const row = workItemFactory.build();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
  });

  it('lists via Express when the work-items domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await getWorkItemsPaginated(1, 10, 'Ship', {
      projectId: row.project_id,
    });

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('work-items');
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/workItems?page=1&limit=10&search=Ship&projectId=${row.project_id}&recordStatus=active`
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result.totalCount).toBe(1);
  });

  it('lists via supabase-js when the toggle is off', async () => {
    createClientMock.mockResolvedValue(createPaginatedSupabase(row));

    const result = await getWorkItemsPaginated(1, 10);

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.workItems).toHaveLength(1);
  });

  it('loads detail via Express when the work-items domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue({ data: row, error: null });

    const result = await getWorkItem(`api-${row.id}`);

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('work-items');
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/workItems/api-${row.id}`);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result?.id).toBe(row.id);
  });

  it('loads detail via supabase-js when the toggle is off', async () => {
    createClientMock.mockResolvedValue(createDetailSupabase(row));

    const result = await getWorkItem(`ssr-${row.id}`);

    expect(createClientMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result?.id).toBe(row.id);
  });
});
