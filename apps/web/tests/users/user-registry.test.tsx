import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserRegistry } from '@/app/users/_components/user-registry';
import { toggleUserActive } from '@/app/users/_services/users.service';
import type { User } from '@/app/users/_services/users.service';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/users',
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'page') return '1';
      if (key === 'limit') return '10';
      return null;
    },
    toString: () => '',
  }),
}));

vi.mock('@/app/users/_services/users.service', () => ({
  toggleUserActive: vi.fn(),
}));

vi.mock('@/app/users/_components/user-form', () => ({
  UserForm: ({
    onClose,
    onSuccess,
    user,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    user?: User;
  }) => (
    <div data-testid="mock-user-form">
      <span>Mock User Form - {user ? user.name : 'Create'}</span>
      <button onClick={onClose}>Close Form</button>
      <button onClick={onSuccess}>Success Form</button>
    </div>
  ),
}));

const mockUsers: User[] = [
  {
    id: 'user-admin-id',
    name: 'Alice Admin',
    email: 'admin@alice.dev',
    role: 'admin' as const,
    active: true,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-bob-id',
    name: 'Bob Member',
    email: 'bob@alice.dev',
    role: 'member' as const,
    active: false,
    created_at: '2026-07-05T10:00:00Z',
    updated_at: '2026-07-05T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'inactive' as const,
    updated_by: null,
  },
];

describe('UserRegistry Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders user list details with roles and status badges', () => {
    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    // Verify Names
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('Bob Member')).toBeInTheDocument();

    // Verify Emails
    expect(screen.getByText('admin@alice.dev')).toBeInTheDocument();
    expect(screen.getByText('bob@alice.dev')).toBeInTheDocument();

    // Verify Role Badges
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();

    // Verify Status Badges
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();

    // Verify "You" badge for current logged-in user
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('activates an inactive user directly', async () => {
    vi.mocked(toggleUserActive).mockResolvedValue({
      id: 'user-bob-id',
      active: true,
    } as unknown as User);

    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    const activateBtn = screen.getByRole('button', { name: /Activate/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(toggleUserActive).toHaveBeenCalledWith('user-bob-id', true);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('opens confirmation modal when deactivating a user', async () => {
    vi.mocked(toggleUserActive).mockResolvedValue({
      id: 'user-bob-id',
      active: false,
    } as unknown as User);

    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    // Click deactivate on the admin user (since they are active, and we cannot deactivate self, wait...)
    // Wait, the code has: `currentUserRole === 'admin' && !isSelf` to show deactivation button.
    // So Bob Member is inactive (shows "Activate" button).
    // Let's make another active user to test deactivation:
    const mockUsersWithTwoActive: User[] = [
      ...mockUsers,
      {
        id: 'user-mgr-id',
        name: 'Charlie Manager',
        email: 'charlie@alice.dev',
        role: 'manager' as const,
        active: true,
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
        created_by: null,
        profile_picture: null,
        status: 'active' as const,
        updated_by: null,
      },
    ];

    render(
      <UserRegistry
        users={mockUsersWithTwoActive}
        totalCount={3}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    const deactivateBtn = screen.getByRole('button', { name: /Deactivate/i });
    fireEvent.click(deactivateBtn);

    // Confirmation dialog should show
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to deactivate/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Deactivate User' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toggleUserActive).toHaveBeenCalledWith('user-mgr-id', false);
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('opens add user modal on Add User button click', () => {
    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add User/i });
    fireEvent.click(addBtn);

    expect(screen.getByTestId('mock-user-form')).toBeInTheDocument();
    expect(screen.getByText('Mock User Form - Create')).toBeInTheDocument();
  });

  it('opens edit user modal on Edit button click', () => {
    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-admin-id"
        currentUserRole="admin"
      />
    );

    const editBtn = screen.getAllByRole('button', { name: 'Edit' })[0];
    fireEvent.click(editBtn!);

    expect(screen.getByTestId('mock-user-form')).toBeInTheDocument();
    expect(
      screen.getByText('Mock User Form - Alice Admin')
    ).toBeInTheDocument();
  });

  it('hides edit, add, and deactivate buttons for non-admin users', () => {
    render(
      <UserRegistry
        users={mockUsers}
        totalCount={2}
        page={1}
        limit={10}
        totalPages={1}
        currentUserId="user-bob-id"
        currentUserRole="member"
      />
    );

    expect(
      screen.queryByRole('button', { name: /Add User/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Deactivate/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Activate/i })
    ).not.toBeInTheDocument();
  });
});
