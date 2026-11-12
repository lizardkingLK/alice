import { describe, expect, it } from 'vitest';
import { resolveChatEmptyGate } from '@/app/chat/_components/chat-client-support';

const base = {
  isLoadingConversations: false,
  modelsReady: true,
  isLoadingModels: false,
  chatModelCount: 1,
  conversationCount: 1,
  hasStartedEmptyConversation: false,
  activeConversationId: 'c1' as string | undefined,
  messageCount: 1,
};

describe('resolveChatEmptyGate', () => {
  it('waits until models are ready', () => {
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: false,
        modelsReady: false,
        chatModelCount: 0,
      })
    ).toBeNull();
  });

  it('shows no-models once ready even while revalidating', () => {
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: true,
        isLoadingModels: true,
        chatModelCount: 0,
      })
    ).toBe('no-models');
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: false,
        isLoadingModels: true,
        chatModelCount: 0,
      })
    ).toBe('no-models');
  });

  it('shows no-models for page and compact layouts', () => {
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: true,
        chatModelCount: 0,
      })
    ).toBe('no-models');
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: false,
        chatModelCount: 0,
      })
    ).toBe('no-models');
  });

  it('keeps no-conversations on the page layout only', () => {
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: true,
        conversationCount: 0,
        hasStartedEmptyConversation: false,
        activeConversationId: undefined,
        messageCount: 0,
      })
    ).toBe('no-conversations');
    expect(
      resolveChatEmptyGate({
        ...base,
        isPage: false,
        conversationCount: 0,
        hasStartedEmptyConversation: false,
        activeConversationId: undefined,
        messageCount: 0,
      })
    ).toBeNull();
  });
});
