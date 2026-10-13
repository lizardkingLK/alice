import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  NotificationMessage,
  stripNotificationMarkdown,
} from '@/lib/notifications/notification-message';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe('stripNotificationMarkdown', () => {
  it('strips bold and link markers for plain tooltips', () => {
    expect(
      stripNotificationMarkdown(
        'Project [**Havit2**](/projects/proj-1) is ready'
      )
    ).toBe('Project Havit2 is ready');
  });
});

describe('NotificationMessage', () => {
  it('renders bold project name and an internal link', () => {
    render(
      <NotificationMessage message="Project [**Havit2**](/projects/proj-1) is ready" />
    );

    const link = screen.getByRole('link', { name: 'Havit2' });
    expect(link).toHaveAttribute('href', '/projects/proj-1');
    expect(link.querySelector('strong')).toHaveTextContent('Havit2');
    expect(screen.getByText(/is ready/)).toBeInTheDocument();
  });

  it('stops propagation and notifies on internal link click', () => {
    const onInternalLinkClick = vi.fn();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <NotificationMessage
          message="Project [**Acme**](/projects/p1) is ready"
          onInternalLinkClick={onInternalLinkClick}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Acme' }));

    expect(onInternalLinkClick).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('renders bold-only failure copy without a link', () => {
    render(
      <NotificationMessage message="Could not create Project **Acme** (ACM)." />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Acme').tagName).toBe('STRONG');
  });
});
