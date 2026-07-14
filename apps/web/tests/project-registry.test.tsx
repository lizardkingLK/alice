import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import {
  softDeleteProject,
  restoreProject,
  hardDeleteProject,
} from '@/app/projects/_components/actions';
import type { Project } from '@/app/projects/_services/projects.service';
import type { User } from '@/app/users/_services/users.service';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/projects',
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'search') return '';
      if (key === 'tab') return 'active';
      return null;
    },
    toString: () => '',
  }),
}));

vi.mock('@/app/projects/_components/actions', () => ({
  softDeleteProject: vi.fn(),
  restoreProject: vi.fn(),
  hardDeleteProject: vi.fn(),
}));

vi.mock('@/app/projects/_components/project-form', () => ({
  ProjectForm: ({
    onClose,
    onSuccess,
    projectId,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    projectId?: string;
  }) => (
    <div data-testid="mock-project-form">
      <span>Mock Project Form - {projectId || 'Create'}</span>
      <button onClick={onClose}>Close Form</button>
      <button onClick={onSuccess}>Success Form</button>
    </div>
  ),
}));

const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Bob Manager',
    email: 'manager@alice.dev',
    role: 'manager',
    active: true,
    created_at: '',
    updated_at: '',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
];

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    key: 'PAL',
    description: 'Description Alpha',
    status: 'active' as const,
    owner_id: 'user-1',
    start_date: '2026-07-01',
    end_date: '2026-07-14',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    created_by: null,
    deleted_at: null,
    updated_by: null,
    attributes_config: null,
    workflow_config: null,
    owner: {
      id: 'user-1',
      name: 'Bob Manager',
      email: 'manager@alice.dev',
    },
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    key: 'PBE',
    description: 'Description Beta',
    status: 'archived' as const,
    owner_id: 'user-1',
    start_date: null,
    end_date: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    created_by: null,
    deleted_at: null,
    updated_by: null,
    attributes_config: null,
    workflow_config: null,
    owner: {
      id: 'user-1',
      name: 'Bob Manager',
      email: 'manager@alice.dev',
    },
  },
];

describe('ProjectRegistry Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders projects registry with list details', () => {
    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    // Verify Project names
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();

    // Verify key slices (first 2 characters)
    // Project Alpha has key "PAL", sliced to "PA"
    expect(screen.getByText('PA')).toBeInTheDocument();
    // Project Beta has key "PBE", sliced to "PB"
    expect(screen.getByText('PB')).toBeInTheDocument();

    // Verify descriptions
    expect(screen.getByText('Description Alpha')).toBeInTheDocument();
    expect(screen.getByText('Description Beta')).toBeInTheDocument();

    // Verify owner details
    expect(screen.getAllByText('Bob Manager')).toHaveLength(2);
  });

  it('handles tab changes', () => {
    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const archivedBtn = screen.getByRole('button', { name: 'Archived' });
    fireEvent.click(archivedBtn);

    expect(mockPush).toHaveBeenCalledWith('/projects?tab=archived&page=1');
  });

  it('handles search input with debounced redirect', async () => {
    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search projects/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/projects?search=Alpha&page=1');
      },
      { timeout: 500 }
    );
  });

  it('opens project form on Add Project button click', () => {
    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Project/i });
    fireEvent.click(addBtn);

    expect(screen.getByTestId('mock-project-form')).toBeInTheDocument();
    expect(screen.getByText('Mock Project Form - Create')).toBeInTheDocument();
  });

  it('opens project form in edit mode on Edit button click', () => {
    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const editBtn = screen.getAllByRole('button', { name: 'Edit' })[0];
    fireEvent.click(editBtn!);

    expect(screen.getByTestId('mock-project-form')).toBeInTheDocument();
    expect(screen.getByText('Mock Project Form - proj-1')).toBeInTheDocument();
  });

  it('performs soft-delete action on confirmation', async () => {
    vi.mocked(softDeleteProject).mockResolvedValue({
      success: true,
      error: null,
    });

    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const deleteBtn = screen.getAllByRole('button', { name: 'Archive' })[0];
    fireEvent.click(deleteBtn!);

    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to archive/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Archive Project' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(softDeleteProject).toHaveBeenCalledWith('proj-1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('performs hard-delete action on confirmation', async () => {
    vi.mocked(hardDeleteProject).mockResolvedValue({
      success: true,
      error: null,
    });

    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="archived"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="admin" // Admin role needed to purge
      />
    );

    const purgeBtn = screen.getAllByRole('button', { name: 'Purge' })[0];
    fireEvent.click(purgeBtn!);

    // Dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to permanently delete/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', {
      name: 'Delete Permanently',
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(hardDeleteProject).toHaveBeenCalledWith('proj-1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('performs restore action directly without modal', async () => {
    vi.mocked(restoreProject).mockResolvedValue({ success: true, error: null });

    render(
      <ProjectRegistry
        projects={mockProjects}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="archived"
        search=""
        users={mockUsers}
        currentUserId="user-1"
        currentUserRole="manager"
      />
    );

    const restoreBtn = screen.getAllByRole('button', { name: 'Restore' })[0];
    fireEvent.click(restoreBtn!);

    await waitFor(() => {
      expect(restoreProject).toHaveBeenCalledWith('proj-1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
