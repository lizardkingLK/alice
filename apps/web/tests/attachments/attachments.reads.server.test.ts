import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getWorkItemAttachments } from '@/app/attachments/_services/attachments.reads.server';

const WORK_ITEM_ID = '11111111-1111-4111-8111-111111111111';

const attachmentRow = {
  id: 'att-1',
  work_item_id: WORK_ITEM_ID,
  file_name: 'spec.pdf',
  file_size: 1024,
  mime_type: 'application/pdf',
  storage_path: `${WORK_ITEM_ID}/spec.pdf`,
  created_at: '2026-07-20T10:00:00.000Z',
  updated_at: '2026-07-20T10:00:00.000Z',
  uploader_id: 'user-1',
  status: 'active',
  created_by: 'user-1',
  updated_by: null,
  uploader: {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    profile_picture: null,
  },
};

function createAttachmentsSupabase(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order,
  };
  return { from: vi.fn(() => chain), chain };
}

describe('attachment server reads retrieval toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
    getUserMock.mockResolvedValue({ id: 'user-1' });
  });

  it('lists via Express when the attachments domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue([
      { ...attachmentRow, created_at: new Date('2026-07-20T10:00:00.000Z') },
    ]);

    const result = await getWorkItemAttachments(WORK_ITEM_ID);

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('attachments');
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/attachments?work_item_id=${WORK_ITEM_ID}`
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.created_at).toBe('2026-07-20T10:00:00.000Z');
    expect(result[0]?.uploader?.name).toBe('Ada');
  });

  it('lists via supabase-js when the toggle is off', async () => {
    const supabase = createAttachmentsSupabase([attachmentRow]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getWorkItemAttachments(WORK_ITEM_ID);

    expect(createClientMock).toHaveBeenCalled();
    expect(supabase.chain.eq).toHaveBeenCalledWith(
      'work_item_id',
      WORK_ITEM_ID
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('returns empty when signed out without reading', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    getUserMock.mockResolvedValue(null);

    const result = await getWorkItemAttachments(WORK_ITEM_ID);

    expect(result).toEqual([]);
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('soft-falls back to empty when the Express read fails', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockRejectedValue(new Error('forbidden'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getWorkItemAttachments(WORK_ITEM_ID);

    expect(result).toEqual([]);
    errorSpy.mockRestore();
  });
});
