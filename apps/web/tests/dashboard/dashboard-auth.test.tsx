import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/auth/actions', () => ({
  signOut: vi.fn(),
}));

describe('AuthControls profile menu', () => {
  it('shows the full Member role badge next to a long display name', () => {
    render(
      <AuthControls
        email="very.long.member.name@example.com"
        name="Very Long Member Display Name"
        role="member"
      />
    );

    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(
      screen.getByText('Very Long Member Display Name')
    ).toBeInTheDocument();
  });
});
