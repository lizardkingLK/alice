import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacklogFilterDialog } from '@/app/backlog/_components/backlog-filter-dialog';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

describe('BacklogFilterDialog', () => {
  const projects: DbProject[] = [
    {
      id: 'proj-1',
      name: 'Alice Platform',
      key: 'AP',
      description: null,
      owner_id: 'user-1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as DbProject,
    {
      id: 'proj-2',
      name: 'EasyPass',
      key: 'EP',
      description: null,
      owner_id: 'user-1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as DbProject,
  ];

  const sprints: Sprint[] = [
    {
      id: 'sprint-1',
      name: 'Sprint 1 Platform',
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-01-14',
      project_id: 'proj-1',
      project: { id: 'proj-1', name: 'Alice Platform', key: 'AP' },
    } as unknown as Sprint,
    {
      id: 'sprint-2',
      name: 'Sprint 2 Platform',
      status: 'planned',
      start_date: '2026-01-15',
      end_date: '2026-01-28',
      project_id: 'proj-1',
      project: { id: 'proj-1', name: 'Alice Platform', key: 'AP' },
    } as unknown as Sprint,
    {
      id: 'sprint-3',
      name: 'Sprint 1 EasyPass',
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-01-14',
      project_id: 'proj-2',
      project: { id: 'proj-2', name: 'EasyPass', key: 'EP' },
    } as unknown as Sprint,
  ];

  const projectMembers: DbUser[] = [
    {
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@alice.dev',
      role: 'admin',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as DbUser,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Sprint tab in the filter navigation and shows all candidate sprints when project is all', () => {
    const onApplyFilters = vi.fn();
    render(
      <BacklogFilterDialog
        projects={projects}
        sprints={sprints}
        projectMembers={projectMembers}
        projectFilter="all"
        sprintFilter=""
        assigneeFilter="all"
        priorityFilter="all"
        activeTab="active"
        hasActiveFilters={false}
        onApplyFilters={onApplyFilters}
      />
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    // Verify all 4 tabs exist
    expect(screen.getByRole('button', { name: /^Project/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Sprint/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Assignee/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Priority/ })).toBeDefined();

    // Switch to Sprint tab
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));

    // Should show All sprints, Sprint 1 Platform, Sprint 2 Platform, Sprint 1 EasyPass
    expect(screen.getByText('All sprints')).toBeDefined();
    expect(screen.getByText('Sprint 1 Platform')).toBeDefined();
    expect(screen.getByText('Sprint 2 Platform')).toBeDefined();
    expect(screen.getByText('Sprint 1 EasyPass')).toBeDefined();
  });

  it('dynamically filters sprint options when a project is selected', () => {
    const onApplyFilters = vi.fn();
    render(
      <BacklogFilterDialog
        projects={projects}
        sprints={sprints}
        projectMembers={projectMembers}
        projectFilter="all"
        sprintFilter=""
        assigneeFilter="all"
        priorityFilter="all"
        activeTab="active"
        hasActiveFilters={false}
        onApplyFilters={onApplyFilters}
      />
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    // Select "Alice Platform" in Project tab
    fireEvent.click(screen.getByText('Alice Platform'));

    // Switch to Sprint tab
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));

    // Should show Alice Platform sprints only
    expect(screen.getByText('All sprints')).toBeDefined();
    expect(screen.getByText('Sprint 1 Platform')).toBeDefined();
    expect(screen.getByText('Sprint 2 Platform')).toBeDefined();
    expect(screen.queryByText('Sprint 1 EasyPass')).toBeNull();
  });

  it('resets selected sprint if user switches project to one that does not contain that sprint', () => {
    const onApplyFilters = vi.fn();
    render(
      <BacklogFilterDialog
        projects={projects}
        sprints={sprints}
        projectMembers={projectMembers}
        projectFilter="proj-1"
        sprintFilter="sprint-1"
        assigneeFilter="all"
        priorityFilter="all"
        activeTab="active"
        hasActiveFilters={true}
        onApplyFilters={onApplyFilters}
      />
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    // Project is currently proj-1. Switch to EasyPass (proj-2)
    fireEvent.click(screen.getByText('EasyPass'));

    // Switch to Sprint tab
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));

    // Sprints should only show EasyPass
    expect(screen.getByText('Sprint 1 EasyPass')).toBeDefined();
    expect(screen.queryByText('Sprint 1 Platform')).toBeNull();

    // Click Okay
    fireEvent.click(screen.getByRole('button', { name: /okay/i }));

    // onApplyFilters should have project: 'proj-2' and sprint reset to 'all'
    expect(onApplyFilters).toHaveBeenCalledWith({
      project: 'proj-2',
      sprint: 'all',
      assignee: 'all',
      priority: 'all',
    });
  });

  it('applies selected sprint when okay is clicked', () => {
    const onApplyFilters = vi.fn();
    render(
      <BacklogFilterDialog
        projects={projects}
        sprints={sprints}
        projectMembers={projectMembers}
        projectFilter="proj-1"
        sprintFilter=""
        assigneeFilter="all"
        priorityFilter="all"
        activeTab="active"
        hasActiveFilters={false}
        onApplyFilters={onApplyFilters}
      />
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    // Switch to Sprint tab
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));

    // Click Sprint 2 Platform
    fireEvent.click(screen.getByText('Sprint 2 Platform'));

    // Click Okay
    fireEvent.click(screen.getByRole('button', { name: /okay/i }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      project: 'proj-1',
      sprint: 'sprint-2',
      assignee: 'all',
      priority: 'all',
    });
  });

  it('resets sprint when Clear All is clicked', () => {
    const onApplyFilters = vi.fn();
    render(
      <BacklogFilterDialog
        projects={projects}
        sprints={sprints}
        projectMembers={projectMembers}
        projectFilter="proj-1"
        sprintFilter="sprint-1"
        assigneeFilter="all"
        priorityFilter="all"
        activeTab="active"
        hasActiveFilters={true}
        onApplyFilters={onApplyFilters}
      />
    );

    // Open filter dialog
    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));

    // Click Clear all
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));

    // Click Okay
    fireEvent.click(screen.getByRole('button', { name: /okay/i }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      project: 'all',
      sprint: 'all',
      assignee: 'all',
      priority: 'all',
    });
  });
});
