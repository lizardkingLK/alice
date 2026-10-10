import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChatLauncherButton,
  ChatLauncherProvider,
} from '@/app/chat/_components/chat-launcher';

const usePathnameMock = vi.fn(() => '/dashboard');
const useSearchParamsMock = vi.fn(
  () => new URLSearchParams() as unknown as ReturnType<
    typeof import('next/navigation').useSearchParams
  >
);

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
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
  ChatClient: () => <div data-testid="chat-drawer-client">Chat</div>,
}));

describe('ChatLauncherButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue('/dashboard');
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<
        typeof import('next/navigation').useSearchParams
      >
    );
  });

  it('opens the Alice drawer from the navbar control', async () => {
    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Alice/i }));

    expect(await screen.findByTestId('chat-drawer-client')).toBeInTheDocument();
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

  it('hides the navbar control on the workflow designer tab', () => {
    usePathnameMock.mockReturnValue('/projects/project-1');
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams('tab=workflow') as unknown as ReturnType<
        typeof import('next/navigation').useSearchParams
      >
    );

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
