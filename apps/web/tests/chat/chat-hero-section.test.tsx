import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatHeroSection from '@/app/chat/_components/chat-client-hero';

describe('ChatHeroSection', () => {
  it('renders invisible scroll and overflow classes on the root container', () => {
    const handleSendMessage = vi.fn();
    const { container } = render(
      <ChatHeroSection isPage={true} handleSendMessage={handleSendMessage} />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('no-scrollbar');
    expect(root).toHaveClass('overflow-y-auto');
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('flex-1');
  });

  it('renders in drawer/compact mode with invisible scroll classes', () => {
    const handleSendMessage = vi.fn();
    const { container } = render(
      <ChatHeroSection isPage={false} handleSendMessage={handleSendMessage} />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('no-scrollbar');
    expect(root).toHaveClass('overflow-y-auto');
  });

  it('triggers handleSendMessage when a suggestion card is clicked', () => {
    const handleSendMessage = vi.fn();
    render(
      <ChatHeroSection isPage={true} handleSendMessage={handleSendMessage} />
    );

    const suggestionButton = screen.getByRole('button', {
      name: /Create new work-item creation flow/i,
    });
    fireEvent.click(suggestionButton);

    expect(handleSendMessage).toHaveBeenCalledWith(
      expect.stringContaining('work-item creation')
    );
  });
});
