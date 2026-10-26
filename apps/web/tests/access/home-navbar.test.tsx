import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeNavbar } from '@/app/_components/home/home-navbar';

vi.mock('@/app/dashboard/_components/dashboard-auth', () => ({
  AuthControls: ({ email }: { email?: string | null }) => (
    <div data-testid="auth-controls">{email ?? 'guest'}</div>
  ),
}));

describe('HomeNavbar', () => {
  it('shows marketing anchors when signed out', () => {
    // Arrange / Act
    render(<HomeNavbar />);

    // Assert
    expect(
      screen.getByRole('link', { name: 'How it works' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('keeps only About and Contact when signed in', () => {
    // Arrange / Act
    render(<HomeNavbar email="ada@example.com" />);

    // Assert
    expect(screen.queryByRole('link', { name: 'How it works' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Pricing' })).toBeNull();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });
});
