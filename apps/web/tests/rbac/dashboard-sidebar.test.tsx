import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('hides System and Projects for member', () => {
    renderSidebar('member');

    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^Projects$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^Sprints$/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
  });
});
