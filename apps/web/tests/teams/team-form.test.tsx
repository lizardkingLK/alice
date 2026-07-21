import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeamForm } from '@/app/manager/_components/team-form';
import { createTeam, updateTeam } from '@/app/manager/_services/teams.service';
import {
  getProjectList,
  getProjectMembers,
} from '@/app/projects/_services/projects.service';
import type { User } from '@/app/users/_services/users.service';
import type { Team } from '@/app/manager/_services/teams.service';
import type {
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.service';

vi.mock('@/app/manager/_services/teams.service', () => ({
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.service', () => ({
  getProjectList: vi.fn().mockResolvedValue([]),
  getProjectMembers: vi.fn().mockResolvedValue([]),
}));

const mockUsers: User[] = [
  {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@alice.dev',
    role: 'admin',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active',
    updated_by: null,
  },
  {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
    role: 'manager',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active',
    updated_by: null,
  },
  {
    id: 'user-dev-1',
    name: 'Developer One',
    email: 'dev1@alice.dev',
    role: 'member',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active',
    updated_by: null,
  },
];

const mockTeam: Team = {
  id: 'team-100',
  name: 'Platform Core',
  tech_stack: 'Next.js, TypeScript',
  description: 'Handles core platform features',
  manager_id: 'user-mgr-1',
  status: 'active',
  created_at: '2026-07-10T10:00:00Z',
  updated_at: '2026-07-10T10:00:00Z',
  created_by: null,
  updated_by: null,
  manager: {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
  },
  members: [
    {
      team_id: 'team-100',
      user_id: 'user-dev-1',
      status: 'active',
    },
  ],
};

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    key: 'ALPHA',
    description: 'Alpha description',
    owner_id: 'user-admin-1',
    status: 'active',
    start_date: null,
    end_date: null,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    attributes_config: null,
    workflow_config: null,
    owner: {
      id: 'user-admin-1',
      name: 'Admin User',
      email: 'admin@alice.dev',
    },
  },
];

const mockProjectMembers: ProjectMemberWithUser[] = [
  {
    project_id: 'proj-1',
    user_id: 'user-dev-1',
    status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    user: {
      id: 'user-dev-1',
      name: 'Developer One',
      email: 'dev1@alice.dev',
      role: 'member',
    },
  },
];

const mockCreatedTeam: Team = {
  id: 'team-new',
  name: 'Frontend Squad',
  tech_stack: 'React, Vite',
  description: 'UI development team',
  manager_id: 'user-mgr-1',
  status: 'active',
  created_at: '2026-07-10T10:00:00Z',
  updated_at: '2026-07-10T10:00:00Z',
  created_by: null,
  updated_by: null,
};

const mockUpdatedTeam: Team = {
  id: 'team-100',
  name: 'Platform Core Updated',
  tech_stack: 'Next.js, TypeScript',
  description: 'Handles core platform features',
  manager_id: 'user-mgr-1',
  status: 'active',
  created_at: '2026-07-10T10:00:00Z',
  updated_at: '2026-07-10T10:00:00Z',
  created_by: null,
  updated_by: null,
};

describe('TeamForm Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders inputs and manager select options correctly', async () => {
    vi.mocked(getProjectList).mockResolvedValue(mockProjects);

    render(<TeamForm users={mockUsers} />);

    expect(screen.getByLabelText(/Team Identifier \/ Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Primary Technology Stack/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Role Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Designated Team Manager/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Associated Project/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getProjectList).toHaveBeenCalled();
    });
  });

  it('validates mandatory fields on submit when empty', async () => {
    render(<TeamForm users={mockUsers} />);

    const submitBtn = screen.getByRole('button', { name: /Create Team/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Team name, manager, and status are required/i)
    ).toBeInTheDocument();
    expect(createTeam).not.toHaveBeenCalled();
  });

  it('submits correctly in create mode and triggers onSuccess callback', async () => {
    const onSuccess = vi.fn();
    vi.mocked(createTeam).mockResolvedValue(mockCreatedTeam);
    vi.mocked(getProjectList).mockResolvedValue(mockProjects);

    render(<TeamForm users={mockUsers} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Team Identifier \/ Name/i), {
      target: { value: 'Frontend Squad' },
    });
    fireEvent.change(screen.getByLabelText(/Primary Technology Stack/i), {
      target: { value: 'React, Vite' },
    });
    fireEvent.change(screen.getByLabelText(/Role Description/i), {
      target: { value: 'UI development team' },
    });

    // Select Manager
    const managerSelect = screen.getByLabelText(/Designated Team Manager/i);
    fireEvent.click(managerSelect);

    const option = await screen.findByRole('option', { name: /Manager One/i });
    fireEvent.click(option);

    const submitBtn = screen.getByRole('button', { name: /Create Team/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith({
        name: 'Frontend Squad',
        tech_stack: 'React, Vite',
        description: 'UI development team',
        manager_id: 'user-mgr-1',
        status: 'active',
        member_ids: [],
      });
    });

    expect(
      await screen.findByText(/A new team record has been successfully registered/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    }, { timeout: 1600 });
  });

  it('populates fields and updates correctly in edit mode', async () => {
    const onSuccess = vi.fn();
    vi.mocked(updateTeam).mockResolvedValue(mockUpdatedTeam);
    vi.mocked(getProjectList).mockResolvedValue(mockProjects);
    vi.mocked(getProjectMembers).mockResolvedValue(mockProjectMembers);

    render(
      <TeamForm
        teamToEdit={mockTeam}
        users={mockUsers}
        onSuccess={onSuccess}
      />
    );

    await waitFor(() => {
      expect(getProjectList).toHaveBeenCalled();
      expect(getProjectMembers).toHaveBeenCalled();
    });

    const nameInput = screen.getByLabelText(/Team Identifier \/ Name/i);
    expect(nameInput).toHaveValue('Platform Core');

    const techInput = screen.getByLabelText(/Primary Technology Stack/i);
    expect(techInput).toHaveValue('Next.js, TypeScript');

    fireEvent.change(nameInput, {
      target: { value: 'Platform Core Updated' },
    });

    const submitBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateTeam).toHaveBeenCalledWith(
        'team-100',
        expect.objectContaining({
          name: 'Platform Core Updated',
          tech_stack: 'Next.js, TypeScript',
          description: 'Handles core platform features',
          manager_id: 'user-mgr-1',
          status: 'active',
        })
      );
    });

    expect(
      await screen.findByText(/The team configuration has been successfully updated/i)
    ).toBeInTheDocument();
  });

  it('loads project members when project is selected and toggles checkbox selection', async () => {
    vi.mocked(getProjectList).mockResolvedValue(mockProjects);
    vi.mocked(getProjectMembers).mockResolvedValue(mockProjectMembers);

    render(<TeamForm users={mockUsers} />);

    await waitFor(() => {
      expect(getProjectList).toHaveBeenCalled();
    });

    const projectSelect = screen.getByLabelText(/Associated Project/i);
    fireEvent.click(projectSelect);

    const option = await screen.findByRole('option', { name: /Project Alpha/i });
    fireEvent.click(option);

    await waitFor(() => {
      expect(getProjectMembers).toHaveBeenCalledWith('proj-1');
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('triggers onClose when dismiss/cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(<TeamForm users={mockUsers} onClose={onClose} />);

    await waitFor(() => {
      expect(getProjectList).toHaveBeenCalled();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
