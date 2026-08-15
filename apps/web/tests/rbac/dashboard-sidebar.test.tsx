import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardSidebar } from '@/app/dashboard/_components/dashboard-sidebar';
import { SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import type { AppRole } from '@/lib/rbac/roles';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/app/board/_hooks/use-workspace-defaults-nav-preference', () => ({
  useWorkspaceDefaultsNavPreference: () => null,
}));

const useFavoritesMock = vi.fn(() => ({
  favorites: [] as Array<{
    id: string;
    pathname: string;
    label: string;
    createdAt: string;
  }>,
  toggle: vi.fn(),
  isFavorited: () => false as boolean,
  normalizePathname: (path: string) => path,
}));

vi.mock('@/lib/favorites/use-favorites', () => ({
  useFavorites: () => useFavoritesMock(),
}));

function renderSidebar(role: AppRole | null) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar role={role} userId="user-1" />
      </SidebarProvider>
    </TooltipProvider>
  );
}

describe('DashboardSidebar RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFavoritesMock.mockReturnValue({
      favorites: [],
      toggle: vi.fn(),
      isFavorited: () => false,
      normalizePathname: (path: string) => path,
    });
  });

  it('shows System and Projects for admin', () => {
    renderSidebar('admin');

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Users$/i })).toHaveAttribute(
      'href',
      '/users'
    );
    expect(screen.getByRole('link', { name: /^Projects$/i })).toHaveAttribute(
      'href',
      '/projects'
    );
    expect(
      screen.getByRole('link', { name: /^Sprints$/i })
    ).toBeInTheDocument();
  });

  it('hides System for manager but keeps Projects', () => {
    renderSidebar('manager');

    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^Users$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^Projects$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^Sprints$/i })
    ).toBeInTheDocument();
  });

  it('hides System for member but keeps Projects (not Sprints)', () => {
    renderSidebar('member');

    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^Projects$/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^Sprints$/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Views$/i })).toHaveAttribute(
      'href',
      '/views'
    );
  });

  it('shows collapsible Favorites with path icons when favorites exist', () => {
    useFavoritesMock.mockReturnValue({
      favorites: [
        {
          id: '1',
          pathname: '/projects',
          label: 'Favorite Projects',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      toggle: vi.fn(),
      isFavorited: () => true,
      normalizePathname: (path: string) => path,
    });

    renderSidebar('member');

    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Favorite Projects/i })
    ).toHaveAttribute('href', '/projects');

    fireEvent.click(
      screen.getByRole('button', { name: /Collapse Favorites/i })
    );
    expect(
      screen.getByRole('button', { name: /Expand Favorites/i })
    ).toBeInTheDocument();
  });

  it('always shows Views and Alice under Platform', () => {
    renderSidebar('member');

    expect(screen.getByRole('link', { name: /^Views$/i })).toHaveAttribute(
      'href',
      '/views'
    );
    const aliceChatLink = screen
      .getAllByRole('link', { name: /^Alice$/i })
      .find((link) => link.getAttribute('href') === '/chat');
    expect(aliceChatLink).toBeDefined();
  });
});
