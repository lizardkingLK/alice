import { describe, expect, it, vi } from 'vitest';
import { runPaginatedSelect } from '@/lib/db/query';

function mockPaginatedQuery(result: {
  data: unknown;
  error: { message: string; code?: string } | null;
  count: number | null;
}) {
  return {
    order() {
      return {
        range() {
          return Promise.resolve(result);
        },
      };
    },
  };
}

describe('runPaginatedSelect', () => {
  it('returns rows and pagination meta from count + page size', async () => {
    const query = mockPaginatedQuery({
      data: [{ id: '1' }, { id: '2' }],
      error: null,
      count: 21,
    });

    const result = await runPaginatedSelect<{ id: string }>(query, 2, 10, {
      orderBy: 'created_at',
      logLabel: 'failed to list',
      errorMessage: 'Failed to list',
    });

    expect(result).toEqual({
      rows: [{ id: '1' }, { id: '2' }],
      totalCount: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it('treats null data as an empty row list', async () => {
    const query = mockPaginatedQuery({
      data: null,
      error: null,
      count: 0,
    });

    const result = await runPaginatedSelect(query, 1, 10, {
      orderBy: 'created_at',
      logLabel: 'failed to list',
      errorMessage: 'Failed to list',
    });

    expect(result.rows).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it('throws the public message when the query errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const query = mockPaginatedQuery({
      data: null,
      error: { message: 'boom' },
      count: null,
    });

    await expect(
      runPaginatedSelect(query, 1, 10, {
        orderBy: 'created_at',
        logLabel: 'failed to list widgets',
        errorMessage: 'Failed to list widgets',
      })
    ).rejects.toThrow('Failed to list widgets');

    expect(errorSpy).toHaveBeenCalledWith(
      'error. failed to list widgets:',
      'boom'
    );
    errorSpy.mockRestore();
  });

  it('returns an empty page when PostgREST range is past the last row', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const query = mockPaginatedQuery({
      data: null,
      error: {
        message: 'Requested range not satisfiable',
        code: 'PGRST103',
      },
      count: 1,
    });

    const result = await runPaginatedSelect(query, 2, 10, {
      orderBy: 'created_at',
      logLabel: 'failed to list',
      errorMessage: 'Failed to list',
    });

    expect(result).toEqual({
      rows: [],
      totalCount: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
