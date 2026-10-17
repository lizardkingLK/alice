import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commentFactory } from '../factories/comment.factory';

const { shouldReadViaApiMock, apiFetchMock, createClientMock, getUserMock } =
  vi.hoisted(() => ({
    shouldReadViaApiMock: vi.fn(() => false),
    apiFetchMock: vi.fn(),
    createClientMock: vi.fn(),
    getUserMock: vi.fn(),
  }));

vi.mock('@/lib/data-retrieval.server', () => ({
  shouldReadViaApi: shouldReadViaApiMock,
}));

vi.mock('@/lib/api/api-fetch.reads.use.server', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/lib/auth', () => ({
  getUser: getUserMock,
  getDbUser: vi.fn(),
}));

import {
  getCommentCountsByWorkItemIds,
  getWorkItemDiscussion,
  listComments,
} from '@/app/comments/_services/comments.reads.server';

function createListSupabase(rows: unknown[]) {
  const result = { data: rows, error: null };
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    // eslint-disable-next-line no-unused-vars
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  };
  return { from: vi.fn(() => chain), chain };
}

function page(
  comments: unknown[],
  pageNumber: number,
  totalPages: number,
  totalCount = comments.length
) {
  return {
    comments,
    totalCount,
    page: pageNumber,
    limit: 100,
    totalPages,
  };
}

describe('comment server reads retrieval toggle', () => {
  const comment = commentFactory.build();

  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
    getUserMock.mockResolvedValue({ id: 'user-1' });
  });

  describe('listComments', () => {
    it('lists via Express with the max page size when the comments domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue(page([comment], 1, 1));

      const result = await listComments();

      expect(shouldReadViaApiMock).toHaveBeenCalledWith('comments');
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/comments?page=1&limit=100'
      );
      expect(createClientMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(comment.id);
    });

    it('scopes to a work item and normalizes dates', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue(
        page(
          [
            {
              ...comment,
              created_at: new Date('2026-07-20T10:00:00.000Z'),
              updated_at: '2026-07-20T11:00:00.000Z',
            },
          ],
          1,
          1
        )
      );

      const result = await listComments(comment.work_item_id);

      expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/comments?page=1&limit=100&workItemId=${comment.work_item_id}`
      );
      expect(result[0]?.created_at).toBe('2026-07-20T10:00:00.000Z');
      expect(result[0]?.updated_at).toBe('2026-07-20T11:00:00.000Z');
    });

    it('fetches remaining pages so threads over 100 comments are not truncated', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      const second = commentFactory.build({ id: 'comment-2' });
      apiFetchMock
        .mockResolvedValueOnce(page([comment], 1, 2, 101))
        .mockResolvedValueOnce(page([second], 2, 2, 101));

      const result = await listComments();

      expect(apiFetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/comments?page=2&limit=100'
      );
      expect(result.map((row) => row.id)).toEqual([comment.id, 'comment-2']);
    });

    it('lists via supabase-js when the toggle is off', async () => {
      const supabase = createListSupabase([comment]);
      createClientMock.mockResolvedValue(supabase);

      const result = await listComments(comment.work_item_id);

      expect(createClientMock).toHaveBeenCalled();
      expect(supabase.chain.eq).toHaveBeenCalledWith(
        'work_item_id',
        comment.work_item_id
      );
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getWorkItemDiscussion', () => {
    it('reads the thread via Express when the comments domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockResolvedValue(page([comment], 1, 1));

      const result = await getWorkItemDiscussion(comment.work_item_id);

      expect(shouldReadViaApiMock).toHaveBeenCalledWith('comments');
      expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/comments?page=1&limit=100&workItemId=${comment.work_item_id}`
      );
      expect(createClientMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('reads the thread via supabase-js when the toggle is off', async () => {
      createClientMock.mockResolvedValue(createListSupabase([comment]));

      const result = await getWorkItemDiscussion(comment.work_item_id);

      expect(createClientMock).toHaveBeenCalled();
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('returns empty when signed out without reading', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      getUserMock.mockResolvedValue(null);

      const result = await getWorkItemDiscussion(comment.work_item_id);

      expect(result).toEqual([]);
      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(createClientMock).not.toHaveBeenCalled();
    });

    it('soft-falls back to empty when the Express read fails', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      apiFetchMock.mockRejectedValue(new Error('boom'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getWorkItemDiscussion(comment.work_item_id);

      expect(result).toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('getCommentCountsByWorkItemIds', () => {
    it('stays on supabase-js even when the comments domain is on api', async () => {
      shouldReadViaApiMock.mockReturnValue(true);
      const eq = vi.fn().mockResolvedValue({
        data: [{ work_item_id: 'wi-1' }, { work_item_id: 'wi-1' }],
        error: null,
      });
      const chain = {
        select: vi.fn(() => chain),
        in: vi.fn(() => chain),
        eq,
      };
      createClientMock.mockResolvedValue({ from: vi.fn(() => chain) });

      const result = await getCommentCountsByWorkItemIds(['wi-1', 'wi-2']);

      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(result).toEqual({ 'wi-1': 2, 'wi-2': 0 });
    });
  });
});
