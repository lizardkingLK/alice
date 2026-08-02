import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamRegistry } from '@/app/manager/_components/team-registry';
import {
  softDeleteTeam as clientSoftDeleteTeam,
  restoreTeam as clientRestoreTeam,
} from '@/app/manager/_services/teams.service';
import { hardDeleteTeam } from '@/app/manager/_components/actions';
import type { Team } from '@/app/manager/_services/teams.service';
import type { User } from '@/app/users/_services/users.service';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/manager',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@repo/ui/components/ui/select', () => {
  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode;
      value: string;
      // eslint-disable-next-line no-unused-vars
      onValueChange: (val: string) => void;
    }) => (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="status-select"
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder: string }) => (
      <>{placeholder}</>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => <option value={value}>{children}</option>,
  };
});

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/manager/_services/teams.service', () => ({
  softDeleteTeam: vi.fn(),
  restoreTeam: vi.fn(),
}));

vi.mock('@/app/manager/_components/actions', () => ({
  hardDeleteTeam: vi.fn(),
}));

vi.mock('@/app/manager/_components/team-form', () => ({
  TeamForm: ({
    onClose,
    onSuccess,
    teamToEdit,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    teamToEdit?: Team | null;
  }) => (
    <div data-testid="mock-team-form">
      <span>Mock Team Form - {teamToEdit ? teamToEdit.name : 'Create'}</span>
      <button onClick={onClose}>Close Form</button>
      <button onClick={onSuccess}>Success Form</button>
    </div>
  ),
}));

const mockUsers: User[] = [
  {
    id: 'user-mgr-1',
    name: 'Alice Manager',
    email: 'alice@alice.dev',
    role: 'manager',
    active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active',
    updated_by: null,
  },
];

const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Core Infrastructure',
    tech_stack: 'Go, Docker, Kubernetes',
    description: 'DevOps & platform squad',
    manager_id: 'user-mgr-1',
    project_id: 'proj-1',
    status: 'active',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    manager: {
      id: 'user-mgr-1',
      name: 'Alice Manager',
      email: 'alice@alice.dev',
    },
    members: [
      {
        team_id: 'team-1',
        user_id: 'user-dev-1',
        status: 'active',
      },
    ],
  },
  {
    id: 'team-2',
    name: 'Legacy Squad',
    tech_stack: 'PHP, MySQL',
    description: 'Legacy web app',
    manager_id: 'user-mgr-1',
    project_id: null,
    status: 'archived',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    created_by: null,
    updated_by: null,
    manager: {
      id: 'user-mgr-1',
      name: 'Alice Manager',
      email: 'alice@alice.dev',
    },
    members: [],
  },
];

describe('TeamRegistry Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders team details, manager info, tech stack, and member counts', () => {
    render(
      <TeamRegistry
        teams={[mockTeams[0]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    expect(screen.getByText('Core Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Alice Manager')).toBeInTheDocument();
    expect(screen.getByText('DevOps & platform squad')).toBeInTheDocument();
  });

  it('handles search input with debounced redirect navigation', async () => {
    render(
      <TeamRegistry
        teams={mockTeams}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const searchInput = screen.getByPlaceholderText(
      /Search teams by name, tech stack, or description/i
    );
    fireEvent.change(searchInput, { target: { value: 'Infrastructure' } });

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith(
          '/manager?search=Infrastructure&page=1'
        );
      },
      { timeout: 800 }
    );
  });

  it('changes tab selection when tab buttons are clicked', () => {
    render(
      <TeamRegistry
        teams={mockTeams}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const select = screen.getAllByTestId('status-select')[0]!;
    fireEvent.change(select, { target: { value: 'archived' } });

    expect(mockPush).toHaveBeenCalledWith('/manager?tab=archived&page=1');
  });

  it('opens confirmation modal and triggers soft delete action', async () => {
    vi.mocked(clientSoftDeleteTeam).mockResolvedValue(mockTeams[0]!);

    render(
      <TeamRegistry
        teams={[mockTeams[0]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const archiveBtn = screen.getByRole('button', { name: 'Archive' });
    fireEvent.click(archiveBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Archive Team' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clientSoftDeleteTeam).toHaveBeenCalledWith(
        'team-1',
        '2026-07-01T00:00:00Z'
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('opens confirmation modal and triggers hard delete for admin role', async () => {
    vi.mocked(hardDeleteTeam).mockResolvedValue({ success: true, error: null });

    render(
      <TeamRegistry
        teams={[mockTeams[1]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="archived"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-admin-1"
        currentUserRole="admin"
      />
    );

    const purgeBtn = screen.getByRole('button', { name: 'Purge' });
    fireEvent.click(purgeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Warning: This action is irreversible/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', {
      name: 'Delete Permanently',
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(hardDeleteTeam).toHaveBeenCalledWith('team-2', null);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('triggers restore team action when restore button clicked in archived tab', async () => {
    vi.mocked(clientRestoreTeam).mockResolvedValue(mockTeams[1]!);

    render(
      <TeamRegistry
        teams={[mockTeams[1]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="archived"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const restoreBtn = screen.getByRole('button', { name: 'Restore' });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(clientRestoreTeam).toHaveBeenCalledWith(
        'team-2',
        '2026-07-01T00:00:00Z'
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('opens add team form dialog on Add Team button click', () => {
    render(
      <TeamRegistry
        teams={mockTeams}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Team/i });
    fireEvent.click(addBtn);

    expect(screen.getByTestId('mock-team-form')).toBeInTheDocument();
    expect(screen.getByText('Mock Team Form - Create')).toBeInTheDocument();
  });

  it('opens edit team form dialog on Edit button click', () => {
    render(
      <TeamRegistry
        teams={[mockTeams[0]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-mgr-1"
        currentUserRole="manager"
      />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editBtn);

    expect(screen.getByTestId('mock-team-form')).toBeInTheDocument();
    expect(
      screen.getByText('Mock Team Form - Core Infrastructure')
    ).toBeInTheDocument();
  });

  it('hides action buttons for standard member role', () => {
    render(
      <TeamRegistry
        teams={[mockTeams[0]!]}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        tab="active"
        search=""
        users={mockUsers}
        activeProjects={[]}
        projectMembersByProjectId={{}}
        currentUserId="user-dev-1"
        currentUserRole="member"
      />
    );

    expect(
      screen.queryByRole('button', { name: /Add Team/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Archive' })
    ).not.toBeInTheDocument();
  });
});
