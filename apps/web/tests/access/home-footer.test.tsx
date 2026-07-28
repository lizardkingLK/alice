import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeFooter } from '@/app/_components/home/home-footer';

describe('HomeFooter', () => {
  it('hides Workspace and Team columns when showAppLinks is false', () => {
    // Arrange / Act
    render(<HomeFooter showAppLinks={false} />);

    // Assert
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Team' })).toBeNull();
    expect(
      screen.getByRole('navigation', { name: 'Account' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Company' })
    ).toBeInTheDocument();
  });

  it('shows Workspace and Team columns when showAppLinks is true', () => {
    // Arrange / Act
    render(<HomeFooter showAppLinks />);

    // Assert
    expect(
      screen.getByRole('navigation', { name: 'Workspace' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Team' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute(
      'href',
      '/users'
    );
  });
});
