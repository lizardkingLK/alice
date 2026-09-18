import { describe, expect, it } from 'vitest';
import { isChatFavoritesReady } from '@/app/chat/_helpers/is-chat-favorites-ready';

describe('isChatFavoritesReady', () => {
  it('is ready on blank /chat when URL and state have no conversation', () => {
    expect(
      isChatFavoritesReady({
        isLoadingConversations: false,
        isLoadingHistory: false,
        activeConversationId: undefined,
        urlConversationId: null,
      })
    ).toBe(true);
  });

  it('is ready when URL conversationId matches the active thread', () => {
    expect(
      isChatFavoritesReady({
        isLoadingConversations: false,
        isLoadingHistory: false,
        activeConversationId: 'conv-1',
        urlConversationId: 'conv-1',
      })
    ).toBe(true);
  });

  it('is not ready while conversations or history are loading', () => {
    expect(
      isChatFavoritesReady({
        isLoadingConversations: true,
        isLoadingHistory: false,
        activeConversationId: 'conv-1',
        urlConversationId: 'conv-1',
      })
    ).toBe(false);
    expect(
      isChatFavoritesReady({
        isLoadingConversations: false,
        isLoadingHistory: true,
        activeConversationId: 'conv-1',
        urlConversationId: 'conv-1',
      })
    ).toBe(false);
  });

  it('is not ready when URL lags behind a newly created conversation', () => {
    expect(
      isChatFavoritesReady({
        isLoadingConversations: false,
        isLoadingHistory: false,
        activeConversationId: 'conv-new',
        urlConversationId: null,
      })
    ).toBe(false);
  });

  it('is not ready when URL still points at a previous conversation', () => {
    expect(
      isChatFavoritesReady({
        isLoadingConversations: false,
        isLoadingHistory: false,
        activeConversationId: 'conv-2',
        urlConversationId: 'conv-1',
      })
    ).toBe(false);
  });
});
