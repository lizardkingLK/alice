import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useChatBootstrap } from '@/app/chat/_helpers/use-chat-bootstrap';

const bootstrapChatShell = vi.fn(async () => ({
  conversations: [{ id: 'c1', title: 'One' }],
  chatModels: [{ id: 'm1', label: 'Model' }],
}));

const bootstrapLatestChat = vi.fn(async () => ({
  conversations: [{ id: 'c1', title: 'One' }],
  activeConversationId: 'c1',
  messages: [],
  chatModels: [{ id: 'm1', label: 'Model' }],
}));

vi.mock('@/app/chat/_components/chat-client-bootstrap', () => ({
  bootstrapChatShell: () => bootstrapChatShell(),
  bootstrapLatestChat: () => bootstrapLatestChat(),
}));

describe('useChatBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the shell once when enabled with preferNewChat', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useChatBootstrap({
          enabled,
          preferNewChat: true,
          logLabel: 'test bootstrap',
        }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => {
      expect(result.current.conversations).not.toBeNull();
      expect(result.current.chatModels).not.toBeNull();
    });

    expect(bootstrapChatShell).toHaveBeenCalledTimes(1);
    expect(bootstrapLatestChat).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(bootstrapChatShell).toHaveBeenCalledTimes(1);
  });

  it('does not auto-load when disabled until ensureLoaded is called', async () => {
    const { result } = renderHook(() =>
      useChatBootstrap({
        enabled: false,
        logLabel: 'lazy bootstrap',
      })
    );

    expect(bootstrapLatestChat).not.toHaveBeenCalled();

    await result.current.ensureLoaded();

    await waitFor(() => {
      expect(result.current.conversations).not.toBeNull();
    });
    expect(bootstrapLatestChat).toHaveBeenCalledTimes(1);
  });
});
