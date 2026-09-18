import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const throwIfErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getUser: getUserMock,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock('@/lib/api/api-fetch.reads.use.server', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/lib/db/query', () => ({
  throwIfError: throwIfErrorMock,
}));

vi.mock('next/cache', () => ({
  // Pass through so listChatConversations hits our mocked Supabase client.
  unstable_cache: (fn: unknown) => fn,
}));

import { getChatPageBootstrap } from '@/app/chat/_services/chat.reads.server';
import type { ChatConversation } from '@/app/chat/_components/chat-client.types';

function conversation(id: string, title = id): ChatConversation {
  return {
    id,
    title,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_processing: false,
  };
}

/**
 * Mocks Supabase query chains used by list + by-id:
 * - `.select().eq().order()` → list result
 * - `.select().eq().eq().maybeSingle()` → by-id result
 */
function mockConversationsClient(options: {
  readonly listResults: Array<ChatConversation[]>;
  readonly byIdResults?: Array<ChatConversation | null>;
}) {
  const listQueue = [...options.listResults];
  const byIdQueue = [...(options.byIdResults ?? [])];

  createAdminClientMock.mockReturnValue({
    from: () => ({
      select: () => {
        const state: { filters: number } = { filters: 0 };
        const builder = {
          eq: () => {
            state.filters += 1;
            return builder;
          },
          order: async () => ({
            data: listQueue.shift() ?? [],
            error: null,
          }),
          maybeSingle: async () => ({
            data: byIdQueue.shift() ?? null,
            error: null,
          }),
        };
        return builder;
      },
    }),
  });
}

describe('getChatPageBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ id: 'user-1' });
    apiFetchMock.mockResolvedValue({ history: [] });
    throwIfErrorMock.mockImplementation(() => undefined);
  });

  it('returns not_found for an unknown conversation id', async () => {
    mockConversationsClient({
      listResults: [[conversation('cached')], [conversation('cached')]],
      byIdResults: [null],
    });

    await expect(getChatPageBootstrap('missing')).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('resolves a fresh conversation by id when list cache/live lag', async () => {
    const fresh = conversation('fresh', 'New Chat');
    mockConversationsClient({
      listResults: [[conversation('older')], [conversation('older')]],
      byIdResults: [fresh],
    });

    const result = await getChatPageBootstrap('fresh');

    expect(result).toEqual({
      ok: true,
      data: {
        conversations: [fresh, conversation('older')],
        activeConversationId: 'fresh',
        messages: [],
      },
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/chat/fresh', {
      method: 'GET',
    });
  });

  it('uses the live list when cache misses but live has the id', async () => {
    const fresh = conversation('fresh', 'New Chat');
    mockConversationsClient({
      listResults: [[conversation('older')], [fresh, conversation('older')]],
    });

    const result = await getChatPageBootstrap('fresh');

    expect(result).toMatchObject({
      ok: true,
      data: {
        activeConversationId: 'fresh',
        conversations: [fresh, conversation('older')],
      },
    });
  });
});
