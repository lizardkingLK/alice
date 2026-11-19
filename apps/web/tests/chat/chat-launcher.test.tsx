import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChatLauncherButton,
  ChatLauncherProvider,
} from '@/app/chat/_components/chat-launcher';
import type { ChatClientProps } from '@/app/chat/_components/chat-client.types';

const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('@/app/chat/_components/chat-client', () => ({
  ChatClient: ({ pageContext }: ChatClientProps) => (
    <div data-testid="alice-dock-client">
      Chat
      {pageContext ? (
        <div data-testid="alice-dock-context">{pageContext.label}</div>
      ) : null}
    </div>
  ),
}));

describe('ChatLauncherButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue('/dashboard');
  });

  it('opens the Alice dock sidebar instantly from the navbar control', () => {
    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Alice/i }));

    expect(screen.getByTestId('alice-dock')).toBeInTheDocument();
    expect(screen.getByTestId('alice-dock-client')).toBeInTheDocument();
    expect(screen.getByTestId('alice-dock-context')).toHaveTextContent(
      'Overview'
    );
  });

  it('keeps the dock mounted (hidden) after close so the session continues', () => {
    render(
      <ChatLauncherProvider>
        <ChatLauncherButton />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Alice/i }));
    expect(screen.getByTestId('alice-dock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Close Alice/i }));
    expect(screen.getByTestId('alice-dock')).toBeInTheDocument();
    expect(screen.getByTestId('alice-dock').closest('div')).toHaveClass(
      'hidden'
    );
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
