import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeSignedInHero } from '@/app/_components/home/home-signed-in-hero';

vi.mock('@/app/_components/home/home-time-greeting', () => ({
  HomeTimeGreeting: ({
    displayName,
    className,
  }: {
    displayName: string;
    className?: string;
  }) => (
    <h1 className={className}>
      Good Morning, <span>{displayName}</span>
    </h1>
  ),
}));

describe('HomeSignedInHero', () => {
  it('centers the greeting and links to the dashboard', () => {
    // Arrange / Act
    const { container } = render(
      <HomeSignedInHero
        displayName="Ada"
        resetSuccess={false}
        accountClosed={false}
      />
    );

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Good Morning, Ada' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(container.querySelector('section')).toHaveClass('items-center');
  });
});
