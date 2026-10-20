import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listConversationsMock,
  loadChatHistoryMock,
  verifyConversationOwnerMock,
  deleteConversationMock,
  resolveChatModelForChatMock,
  setProcessingStatusMock,
  saveChatHistoryMock,
  processChatAsyncMock,
} = vi.hoisted(() => ({
  listConversationsMock: vi.fn(),
  loadChatHistoryMock: vi.fn(),
  verifyConversationOwnerMock: vi.fn(),
  deleteConversationMock: vi.fn(),
  resolveChatModelForChatMock: vi.fn(),
  setProcessingStatusMock: vi.fn(),
  saveChatHistoryMock: vi.fn(),
  processChatAsyncMock: vi.fn(),
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
    setProcessingStatus = setProcessingStatusMock;
    saveChatHistory = saveChatHistoryMock;
    processChatAsync = processChatAsyncMock;
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
  setProcessingStatus: setProcessingStatusMock,
  saveChatHistory: saveChatHistoryMock,
  processChatAsync: processChatAsyncMock,
} as unknown as ChatService;

const chatRouter = createChatRouter({ chatService });

const conversationId = '11111111-1111-4111-8111-111111111111';
const integrationId = '22222222-2222-4222-8222-222222222222';

describe('chat routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyConversationOwnerMock.mockResolvedValue(true);
    setProcessingStatusMock.mockResolvedValue(undefined);
    saveChatHistoryMock.mockResolvedValue(undefined);
    processChatAsyncMock.mockResolvedValue(undefined);
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

  it('starts background processing for an owned existing conversation with the selected model', async () => {
    const chatModelConfig = {
      integrationId,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
      apiUrl: 'https://api.anthropic.com/v1/messages',
    };
    resolveChatModelForChatMock.mockResolvedValue(chatModelConfig);

    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { id: 'message-1', role: 'user', content: 'Continue this chat' },
          ],
          conversationId,
          integrationId,
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        reply: 'Processing request...',
        conversationId,
        is_processing: true,
        actions: [],
        history: [
          {
            id: 'message-1',
            role: 'user',
            content: 'Continue this chat',
            actions: [],
          },
        ],
      });
    });

    expect(resolveChatModelForChatMock).toHaveBeenCalledWith({
      integrationId,
      legacyModelId: undefined,
    });
    expect(verifyConversationOwnerMock).toHaveBeenCalledWith(
      MOCK_AUTH_USER_ID,
      conversationId
    );
    expect(setProcessingStatusMock).toHaveBeenCalledWith(conversationId, true);
    expect(saveChatHistoryMock).toHaveBeenCalledWith(
      conversationId,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-1',
          role: 'user',
          content: 'Continue this chat',
        }),
      ])
    );
    expect(processChatAsyncMock).toHaveBeenCalledWith(
      MOCK_AUTH_USER_ID,
      conversationId,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-1',
          content: 'Continue this chat',
        }),
      ]),
      chatModelConfig,
      undefined
    );
  });

  it('rejects an existing-conversation message from a non-owner before saving or processing', async () => {
    resolveChatModelForChatMock.mockResolvedValue({
      integrationId,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'test-key',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
    });
    verifyConversationOwnerMock.mockResolvedValue(false);

    await withMountedRouter('/api/v1/chat', chatRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Unauthorized message' }],
          conversationId,
          integrationId,
        }),
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'Access denied: You do not own this conversation.',
      });
    });

    expect(verifyConversationOwnerMock).toHaveBeenCalledWith(
      MOCK_AUTH_USER_ID,
      conversationId
    );
    expect(setProcessingStatusMock).not.toHaveBeenCalled();
    expect(saveChatHistoryMock).not.toHaveBeenCalled();
    expect(processChatAsyncMock).not.toHaveBeenCalled();
  });
});
