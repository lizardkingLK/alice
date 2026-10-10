import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChatLauncherButton,
  ChatLauncherProvider,
} from '@/app/chat/_components/chat-launcher';

const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('@/app/chat/_components/chat-client-bootstrap', () => ({
  bootstrapLatestChat: vi.fn(async () => ({
    conversations: [],
    activeConversationId: undefined,
    messages: [],
    chatModels: [],
  })),
}));

vi.mock('@/app/chat/_components/chat-client', () => ({
  ChatClient: () => <div data-testid="alice-dock-client">Chat</div>,
}));

describe('ChatLauncherButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue('/dashboard');
  });

  it('opens the Alice dock sidebar from the navbar control', async () => {
    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Alice/i }));

    expect(await screen.findByTestId('alice-dock')).toBeInTheDocument();
    expect(await screen.findByTestId('alice-dock-client')).toBeInTheDocument();
  });

  it('toggles the dock closed from the navbar control', async () => {
    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Alice/i }));
    expect(await screen.findByTestId('alice-dock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Close Alice/i }));
    expect(screen.queryByTestId('alice-dock')).not.toBeInTheDocument();
  });

  it('hides the navbar control on the full /chat page', () => {
    usePathnameMock.mockReturnValue('/chat');

    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    expect(
      screen.queryByRole('button', { name: /Open Alice/i })
    ).not.toBeInTheDocument();
  });
});
