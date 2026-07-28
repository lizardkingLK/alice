import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { TeamForm } from '@/app/manager/_components/team-form';
import { createTeam, updateTeam } from '@/app/manager/_services/teams.service';
import type { User } from '@/app/users/_services/users.service';
import type { Team } from '@/app/manager/_services/teams.service';
import type {
  Project,
  ProjectMemberWithUser,
  ProjectMembersByProjectId,
} from '@/app/projects/_services/projects.service.base';

vi.mock('@/app/manager/_services/teams.service', () => ({
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
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
  {
    id: 'user-dev-2',
    name: 'Developer Two',
    email: 'dev2@alice.dev',
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
  project_id: 'proj-1',
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
  {
    id: 'proj-2',
    name: 'Project Beta',
    key: 'BETA',
    description: 'Beta description',
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
  {
    project_id: 'proj-1',
    user_id: 'user-dev-2',
    status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    user: {
      id: 'user-dev-2',
      name: 'Developer Two',
      email: 'dev2@alice.dev',
      role: 'member',
    },
  },
];

const mockProjectMembersByProjectId: ProjectMembersByProjectId = {
  'proj-1': mockProjectMembers,
  'proj-2': [
    {
      project_id: 'proj-2',
      user_id: 'user-dev-2',
      status: 'active',
      created_at: '2026-07-09T10:00:00Z',
      user: {
        id: 'user-dev-2',
        name: 'Developer Two',
        email: 'dev2@alice.dev',
        role: 'member',
      },
    },
  ],
};

const mockCreatedTeam: Team = {
  id: 'team-new',
  name: 'Frontend Squad',
  tech_stack: 'React, Vite',
  description: 'UI development team',
  manager_id: 'user-mgr-1',
  project_id: 'proj-1',
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
  project_id: 'proj-1',
  status: 'active',
  created_at: '2026-07-10T10:00:00Z',
  updated_at: '2026-07-10T10:00:00Z',
  created_by: null,
  updated_by: null,
};

function renderTeamForm(props: Partial<ComponentProps<typeof TeamForm>> = {}) {
  return render(
    <TeamForm
      users={mockUsers}
      activeProjects={mockProjects}
      projectMembersByProjectId={mockProjectMembersByProjectId}
      {...props}
    />
  );
}

async function selectManagerAndProject() {
  fireEvent.click(screen.getByLabelText(/Designated Team Manager/i));
  fireEvent.click(await screen.findByRole('option', { name: /Manager One/i }));

  fireEvent.click(screen.getByLabelText(/Associated Project/i));
  fireEvent.click(
    await screen.findByRole('option', { name: /Project Alpha/i })
  );
}

describe('TeamForm Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders inputs and manager select options correctly', () => {
    renderTeamForm();

    expect(
      screen.getByLabelText(/Team Identifier \/ Name/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Primary Technology Stack/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Role Description/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Designated Team Manager/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Associated Project/i)).toBeInTheDocument();
  });

  it('validates mandatory fields on submit when empty', async () => {
    renderTeamForm();

    const submitBtn = screen.getByRole('button', { name: /Create Team/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Team name, manager, and status are required/i)
    ).toBeInTheDocument();
    expect(createTeam).not.toHaveBeenCalled();
  });

  it('requires associated project before create', async () => {
    renderTeamForm();

    fireEvent.change(screen.getByLabelText(/Team Identifier \/ Name/i), {
      target: { value: 'Frontend Squad' },
    });

    fireEvent.click(screen.getByLabelText(/Designated Team Manager/i));
    fireEvent.click(
      await screen.findByRole('option', { name: /Manager One/i })
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Team/i }));

    expect(
      await screen.findByText(/Associated project is required/i)
    ).toBeInTheDocument();
    expect(createTeam).not.toHaveBeenCalled();
  });

  it('submits correctly in create mode with project_id and triggers onSuccess', async () => {
    const onSuccess = vi.fn();
    vi.mocked(createTeam).mockResolvedValue(mockCreatedTeam);

    renderTeamForm({ onSuccess });

    fireEvent.change(screen.getByLabelText(/Team Identifier \/ Name/i), {
      target: { value: 'Frontend Squad' },
    });
    fireEvent.change(screen.getByLabelText(/Primary Technology Stack/i), {
      target: { value: 'React, Vite' },
    });
    fireEvent.change(screen.getByLabelText(/Role Description/i), {
      target: { value: 'UI development team' },
    });

    await selectManagerAndProject();

    fireEvent.click(screen.getByRole('button', { name: /Create Team/i }));

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith({
        name: 'Frontend Squad',
        tech_stack: 'React, Vite',
        description: 'UI development team',
        manager_id: 'user-mgr-1',
        project_id: 'proj-1',
        status: 'active',
        member_ids: [],
      });
    });

    expect(
      await screen.findByText(
        /A new team record has been successfully registered/i
      )
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(onSuccess).toHaveBeenCalled();
      },
      { timeout: 1600 }
    );
  });

  it('submits selected project members as member_ids on create', async () => {
    vi.mocked(createTeam).mockResolvedValue(mockCreatedTeam);

    renderTeamForm();

    fireEvent.change(screen.getByLabelText(/Team Identifier \/ Name/i), {
      target: { value: 'Frontend Squad' },
    });

    await selectManagerAndProject();

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Create Team/i }));

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Frontend Squad',
          manager_id: 'user-mgr-1',
          project_id: 'proj-1',
          member_ids: ['user-dev-1'],
        })
      );
    });
  });

  it('populates fields from team.project_id and updates correctly in edit mode', async () => {
    const onSuccess = vi.fn();
    vi.mocked(updateTeam).mockResolvedValue(mockUpdatedTeam);

    renderTeamForm({ teamToEdit: mockTeam, onSuccess });

    const nameInput = screen.getByLabelText(/Team Identifier \/ Name/i);
    expect(nameInput).toHaveValue('Platform Core');

    const projectTrigger = screen.getByLabelText(/Associated Project/i);
    expect(projectTrigger).toHaveTextContent(/Project Alpha/i);
    expect(projectTrigger).toBeDisabled();

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    expect(checkbox).toBeChecked();

    fireEvent.change(nameInput, {
      target: { value: 'Platform Core Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateTeam).toHaveBeenCalledWith(
        'team-100',
        expect.objectContaining({
          name: 'Platform Core Updated',
          tech_stack: 'Next.js, TypeScript',
          description: 'Handles core platform features',
          manager_id: 'user-mgr-1',
          status: 'active',
          member_ids: ['user-dev-1'],
        })
      );
    });

    expect(
      await screen.findByText(
        /The team configuration has been successfully updated/i
      )
    ).toBeInTheDocument();
  });

  it('locks the project dropdown on edit', () => {
    renderTeamForm({ teamToEdit: mockTeam });

    const projectTrigger = screen.getByLabelText(/Associated Project/i);
    expect(projectTrigger).toBeDisabled();
    expect(projectTrigger).toHaveTextContent(/Project Alpha/i);
    expect(
      screen.getByText(/Project is fixed for this team/i)
    ).toBeInTheDocument();
  });

  it('shows all project members on edit with only team members checked', async () => {
    renderTeamForm({ teamToEdit: mockTeam });

    const checked = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    const unchecked = screen.getByRole('checkbox', {
      name: /Developer Two/i,
    });
    expect(checked).toBeChecked();
    expect(unchecked).not.toBeChecked();
  });

  it('keeps unchecked members in the list after unselecting', async () => {
    renderTeamForm({ teamToEdit: mockTeam });

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Developer One/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Developer Two/i })
    ).toBeInTheDocument();
  });

  it('shows team members as checked on edit even if prefetch map is empty', async () => {
    renderTeamForm({
      teamToEdit: mockTeam,
      projectMembersByProjectId: { 'proj-1': [], 'proj-2': [] },
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    expect(checkbox).toBeChecked();
  });

  it('allows selecting a project on edit when team.project_id is null', async () => {
    const onSuccess = vi.fn();
    renderTeamForm({
      teamToEdit: { ...mockTeam, project_id: null },
      onSuccess,
    });

    const projectTrigger = screen.getByLabelText(/Associated Project/i);
    expect(projectTrigger).not.toBeDisabled();
    expect(
      screen.getByText(/This team has no project yet/i)
    ).toBeInTheDocument();

    fireEvent.click(projectTrigger);
    fireEvent.click(
      await screen.findByRole('option', { name: /Project Alpha/i })
    );

    expect(
      await screen.findByRole('checkbox', { name: /Developer Two/i })
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Developer One/i })
    ).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateTeam).toHaveBeenCalledWith(
        'team-100',
        expect.objectContaining({
          project_id: 'proj-1',
          member_ids: ['user-dev-1'],
        })
      );
    });
  });

  it('clears member selection when switching projects on create', async () => {
    renderTeamForm();

    fireEvent.click(screen.getByLabelText(/Associated Project/i));
    fireEvent.click(
      await screen.findByRole('option', { name: /Project Alpha/i })
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByLabelText(/Associated Project/i));
    fireEvent.click(
      await screen.findByRole('option', { name: /Project Beta/i })
    );

    const betaMember = await screen.findByRole('checkbox', {
      name: /Developer Two/i,
    });
    expect(betaMember).not.toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: /Developer One/i })
    ).not.toBeInTheDocument();
  });

  it('loads project members when project is selected and toggles checkbox selection', async () => {
    renderTeamForm();

    fireEvent.click(screen.getByLabelText(/Associated Project/i));
    fireEvent.click(
      await screen.findByRole('option', { name: /Project Alpha/i })
    );

    const checkbox = await screen.findByRole('checkbox', {
      name: /Developer One/i,
    });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('triggers onClose when dismiss/cancel button is clicked', () => {
    const onClose = vi.fn();
    renderTeamForm({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
