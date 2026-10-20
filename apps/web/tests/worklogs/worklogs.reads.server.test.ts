import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getWorkItemWorkLogs } from '@/app/worklogs/_services/worklogs.reads.server';

const WORK_ITEM_ID = '11111111-1111-4111-8111-111111111111';

const workLogRow = {
  id: 'log-1',
  work_item_id: WORK_ITEM_ID,
  user_id: 'user-1',
  logged_hours: 2.5,
  logged_at: '2026-07-20T00:00:00.000Z',
  comment: 'Pairing',
  user: {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    profile_picture: null,
  },
};

function createWorkLogsSupabase(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order,
  };
  return { from: vi.fn(() => chain), chain };
}

describe('work log server reads retrieval toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldReadViaApiMock.mockReturnValue(false);
  });

  it('lists via Express when the worklogs domain is on api', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue([
      { ...workLogRow, logged_at: new Date('2026-07-20T00:00:00.000Z') },
    ]);

    const result = await getWorkItemWorkLogs(WORK_ITEM_ID);

    expect(shouldReadViaApiMock).toHaveBeenCalledWith('worklogs');
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/worklogs?work_item_id=${WORK_ITEM_ID}`
    );
    expect(createClientMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.logged_at).toBe('2026-07-20T00:00:00.000Z');
    expect(result[0]?.logged_hours).toBe(2.5);
    expect(result[0]?.user?.name).toBe('Ada');
  });

  it('normalizes a missing user embed to null on the Express path', async () => {
    shouldReadViaApiMock.mockReturnValue(true);
    apiFetchMock.mockResolvedValue([{ ...workLogRow, user: undefined }]);

    const result = await getWorkItemWorkLogs(WORK_ITEM_ID);

    expect(result[0]?.user).toBeNull();
  });

  it('lists via supabase-js when the toggle is off', async () => {
    const supabase = createWorkLogsSupabase([workLogRow]);
    createClientMock.mockResolvedValue(supabase);

    const result = await getWorkItemWorkLogs(WORK_ITEM_ID);

    expect(createClientMock).toHaveBeenCalled();
    expect(supabase.chain.eq).toHaveBeenCalledWith(
      'work_item_id',
      WORK_ITEM_ID
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
