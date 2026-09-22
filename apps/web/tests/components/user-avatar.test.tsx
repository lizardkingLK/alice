import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatar } from '@/components/user-avatar';

describe('UserAvatar', () => {
  it('preserves the initials fallback when presence is omitted', () => {
    render(<UserAvatar name="Alice Admin" />);

    expect(screen.getByText('AA')).toBeInTheDocument();
    expect(screen.queryByLabelText('Online')).not.toBeInTheDocument();
  });

  it('does not render an online badge when isOnline is false', () => {
    render(<UserAvatar name="Alice Admin" isOnline={false} />);

    expect(screen.queryByLabelText('Online')).not.toBeInTheDocument();
  });

  it('renders a small green badge when isOnline is true', () => {
    render(<UserAvatar name="Alice Admin" isOnline />);

    expect(screen.getByLabelText('Online')).toHaveClass(
      'size-2',
      'bg-emerald-500',
      'top-0',
      'right-0'
    );
  });

  it('keeps the fallback available while an image loads', () => {
    render(
      <UserAvatar
        name="Alice Admin"
        imageUrl="https://example.com/alice.png"
        isOnline
      />
    );

    expect(screen.getByText('AA')).toBeInTheDocument();
    expect(screen.getByLabelText('Online')).toBeInTheDocument();
  });
});
