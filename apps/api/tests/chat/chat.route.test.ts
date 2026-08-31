import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listConversationsMock,
  loadChatHistoryMock,
  verifyConversationOwnerMock,
  deleteConversationMock,
  resolveChatModelForChatMock,
} = vi.hoisted(() => ({
  listConversationsMock: vi.fn(),
  loadChatHistoryMock: vi.fn(),
  verifyConversationOwnerMock: vi.fn(),
  deleteConversationMock: vi.fn(),
  resolveChatModelForChatMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/chat/chat.service', () => {
  class ChatService {
    listConversations = listConversationsMock;
    loadChatHistory = loadChatHistoryMock;
    verifyConversationOwner = verifyConversationOwnerMock;
    deleteConversation = deleteConversationMock;
    resolveChatModelForChat = resolveChatModelForChatMock;
  }

  return { ChatService, sanitizeLog: (value: string) => value };
});

import { createChatRouter } from '../../src/routes/api/chat/chat.route';
import type { ChatService } from '../../src/routes/api/chat/chat.service';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const chatService = {
  listConversations: listConversationsMock,
  loadChatHistory: loadChatHistoryMock,
  verifyConversationOwner: verifyConversationOwnerMock,
  deleteConversation: deleteConversationMock,
  resolveChatModelForChat: resolveChatModelForChatMock,
} as unknown as ChatService;

const chatRouter = createChatRouter({ chatService });

const conversationId = '11111111-1111-4111-8111-111111111111';
const integrationId = '22222222-2222-4222-8222-222222222222';

describe('chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyConversationOwnerMock.mockResolvedValue(true);
  });

  it('returns 400 for invalid post bodies', async () => {
    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });

      expect(response.status).toBe(400);
      expect(resolveChatModelForChatMock).not.toHaveBeenCalled();
    });
  });

  it('returns 400 for invalid conversation id params', async () => {
    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat/not-a-uuid`, {
        method: 'GET',
      });

      expect(response.status).toBe(400);
      expect(loadChatHistoryMock).not.toHaveBeenCalled();
    });
  });

  it('loads history for an owned conversation', async () => {
    const history = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
      },
    ];
    loadChatHistoryMock.mockResolvedValue(history);

    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat/${conversationId}`, {
        method: 'GET',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ history });
      expect(verifyConversationOwnerMock).toHaveBeenCalledWith(
        MOCK_AUTH_USER_ID,
        conversationId
      );
    });
  });

  it('deletes an owned conversation', async () => {
    deleteConversationMock.mockResolvedValue(undefined);

    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat/${conversationId}`, {
        method: 'DELETE',
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      expect(deleteConversationMock).toHaveBeenCalledWith(
        MOCK_AUTH_USER_ID,
        conversationId
      );
    });
  });

  it('returns 400 when no chat model can be resolved', async () => {
    resolveChatModelForChatMock.mockRejectedValue(
      new Error('No chat model configured')
    );

    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          integrationId,
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('No chat model configured');
    });
  });
});
