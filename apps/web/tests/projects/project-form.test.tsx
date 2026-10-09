import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectForm } from '@/app/projects/_components/project-form';
import {
  createProject,
  updateProject,
} from '@/app/projects/_services/projects.mutations.client';
import { invalidateProjectDropdownCache } from '@/app/projects/_services/projects.cache.actions.server';
import type { User } from '@/app/users/_services/users.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import {
  getComboboxOptions,
  pickComboboxOption,
} from '../helpers/pick-combobox-option';

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.cache.actions.server', () => ({
  invalidateProjectDropdownCache: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/select', () =>
  import('../mocks/select').then((module) => module.createSelectMock())
);

const mockUsers: User[] = [
  {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@alice.dev',
    role: 'admin',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
    role: 'manager',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-2',
    name: 'Manager Two',
    email: 'mgr2@alice.dev',
    role: 'manager',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-member',
    name: 'Member User',
    email: 'member@alice.dev',
    role: 'member',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
];

const mockProject = {
  id: 'proj-123',
  name: 'Project Alice',
  key: 'ALICE',
  description: 'Project description details',
  owner_id: 'user-mgr-1',
  status: 'active' as const,
  start_date: '2026-07-10',
  end_date: '2026-08-10',
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
  created_by: null,
  deleted_at: null,
  updated_by: null,
  attributes_config: null,
  workflow_config: null,
  jira_connection_id: null,
  jira_project_key: null,
  github_repo: null,
  has_github_token: false,
  logo_url: null,
  cover_picture: null,
  owner: {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
  },
};

const mockJiraConnection = {
  id: 'conn-1',
  user_id: 'user-mgr-1',
  cloud_id: 'cloud-1',
  site_url: 'https://test.atlassian.net',
  account_email: 'me@test.com',
  scopes: 'read:jira-work',
  status: 'active' as const,
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
};

const mockGithubConnection = {
  id: 'conn-gh-1',
  name: 'GitHub (octocat)',
  status: 'active' as const,
  account_login: 'octocat',
  account_avatar_url: 'https://github.com/images/error/octocat_happy.gif',
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
};

function mockJiraApiFetch(options?: {
  connections?: (typeof mockJiraConnection)[];
  importedCount?: number;
  githubConnections?: (typeof mockGithubConnection)[];
  githubRepos?: unknown[];
}) {
  const connections = options?.connections ?? [mockJiraConnection];
  const importedCount = options?.importedCount ?? 2;
  const githubConnections = options?.githubConnections ?? [];
  const githubRepos = options?.githubRepos ?? [];

  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/api/jira/connections') {
      return { connections };
    }
    if (path === '/api/jira/connections/conn-1/projects') {
      return {
        projects: [{ id: '10000', key: 'TEST', name: 'Test Project' }],
      };
    }
    if (path === '/api/projects/proj-123/jira/import') {
      return { importedCount };
    }
    if (path === '/api/jira/oauth/start') {
      return { url: 'https://auth.atlassian.com/authorize' };
    }
    if (path === '/api/github/connections') {
      return { connections: githubConnections };
    }
    if (path.startsWith('/api/github/repositories')) {
      return { repositories: githubRepos };
    }
    if (path === '/api/github/oauth/start') {
      return { url: 'https://github.com/login/oauth/authorize' };
    }
    throw new Error(`Unexpected apiFetch path: ${path}`);
  });
}

async function fillStep1Basics() {
  fireEvent.change(screen.getByLabelText(/Project Name/i), {
    target: { value: 'Project Alice' },
  });
  fireEvent.change(screen.getByLabelText(/Project Key/i), {
    target: { value: 'alice' },
  });
  await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');
}

import { clearGithubCache } from '@/app/projects/_services/github-connection-cache';

async function advanceCreateFormToSprintStep() {
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  await screen.findByText('Import sources');
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  await screen.findByText('Source control');
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  await screen.findByRole('checkbox', { name: /Create an initial sprint/i });
}

async function advanceCreateFormToTeamStep() {
  await advanceCreateFormToSprintStep();
  fireEvent.click(screen.getByRole('button', { name: /Next/i }));
  await screen.findByRole('checkbox', { name: /Create an initial team/i });
}

describe('ProjectForm Component', () => {
  beforeEach(() => {
    clearGithubCache();
    mockJiraApiFetch({ connections: [] });
    vi.mocked(invalidateProjectDropdownCache).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearGithubCache();
  });

  it('renders owner dropdown filtered only to managers', async () => {
    render(<ProjectForm users={mockUsers} />);

    const ownerSelect = screen.getByLabelText(/Project Owner/i);
    expect(ownerSelect).toBeInTheDocument();

    const options = await getComboboxOptions(/Project Owner/i);
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Manager One (mgr1@alice.dev)');
    expect(options[1]).toHaveTextContent('Manager Two (mgr2@alice.dev)');
  });

  it('performs required field validation on submit', async () => {
    render(<ProjectForm users={mockUsers} />);

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/Project Name is required/i)
    ).toBeInTheDocument();
  });

  it('submits correctly in create mode and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onProjectUpdated = vi.fn();
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(
      <ProjectForm
        users={mockUsers}
        onSuccess={onSuccess}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Project description details' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    const endDateStr = endDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: startDateStr },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: endDateStr },
    });

    await advanceCreateFormToTeamStep();
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        name: 'Project Alice',
        key: 'ALICE',
        description: 'Project description details',
        owner_id: 'user-mgr-1',
        start_date: startDateStr,
        end_date: endDateStr,
        status: 'active',
        attributes_config: null,
        workflow_config: {
          work_item_types: ['Epic', 'Feature', 'Story', 'Task', 'Issue'],
        },
        jira_connection_id: null,
        jira_project_key: null,
        github_repo: null,
        github_token: null,
      });
    });

    expect(
      await screen.findByText(/Project "Project Alice" created/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith(mockProject);
    expect(invalidateProjectDropdownCache).toHaveBeenCalledOnce();
    expect(vi.mocked(createProject).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(invalidateProjectDropdownCache).mock.invocationCallOrder[0]!
    );
    expect(
      vi.mocked(invalidateProjectDropdownCache).mock.invocationCallOrder[0]
    ).toBeLessThan(onProjectUpdated.mock.invocationCallOrder[0]!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled(), {
      timeout: 2_000,
    });
    expect(
      vi.mocked(invalidateProjectDropdownCache).mock.invocationCallOrder[0]
    ).toBeLessThan(onSuccess.mock.invocationCallOrder[0]!);
  });

  it('keeps sprint state local and includes it in the project create payload', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    await advanceCreateFormToSprintStep();

    expect(createProject).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial sprint/i })
    );
    fireEvent.change(screen.getByLabelText(/Sprint Name/i), {
      target: { value: 'Sprint 1' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint Goal/i), {
      target: { value: 'Initial delivery' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint Start Date/i), {
      target: { value: '2099-09-01' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint End Date/i), {
      target: { value: '2099-09-14' },
    });

    expect(createProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial team/i });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          sprint: {
            name: 'Sprint 1',
            goal: 'Initial delivery',
            startDate: '2099-09-01',
            endDate: '2099-09-14',
          },
        })
      );
    });
    expect(invalidateProjectDropdownCache).toHaveBeenCalledOnce();
    expect(apiFetch).not.toHaveBeenCalledWith(
      '/api/sprints',
      expect.anything()
    );
  });

  it('blocks project creation when enabled sprint data is invalid', async () => {
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    await advanceCreateFormToSprintStep();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial sprint/i })
    );
    fireEvent.change(screen.getByLabelText(/Sprint Name/i), {
      target: { value: 'Sprint 1' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint Start Date/i), {
      target: { value: '2099-09-14' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint End Date/i), {
      target: { value: '2099-09-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByText('End date must be on or after the start date')
    ).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('includes a trimmed optional team in the project create payload', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    await advanceCreateFormToTeamStep();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial team/i })
    );
    fireEvent.change(screen.getByLabelText(/Team Name/i), {
      target: { value: '  Platform Team  ' },
    });
    fireEvent.change(screen.getByLabelText(/^Description$/i), {
      target: { value: '  Builds the platform  ' },
    });
    fireEvent.change(screen.getByLabelText(/Technology Stack/i), {
      target: { value: '  TypeScript  ' },
    });
    await pickComboboxOption(/Team Manager/i, 'Manager One (mgr1@alice.dev)');
    fireEvent.click(screen.getByRole('checkbox', { name: /Member User/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          team: {
            name: 'Platform Team',
            description: 'Builds the platform',
            manager_id: 'user-mgr-1',
            tech_stack: 'TypeScript',
            status: 'active',
            member_ids: ['user-member'],
          },
        })
      );
    });
  });

  it('includes both optional team and sprint data in one create payload', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    await advanceCreateFormToSprintStep();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial sprint/i })
    );
    fireEvent.change(screen.getByLabelText(/Sprint Name/i), {
      target: { value: 'Sprint 1' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint Start Date/i), {
      target: { value: '2099-09-01' },
    });
    fireEvent.change(screen.getByLabelText(/Sprint End Date/i), {
      target: { value: '2099-09-14' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial team/i });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial team/i })
    );
    fireEvent.change(screen.getByLabelText(/Team Name/i), {
      target: { value: 'Platform Team' },
    });
    await pickComboboxOption(/Team Manager/i, 'Manager One (mgr1@alice.dev)');
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          sprint: expect.objectContaining({ name: 'Sprint 1' }),
          team: expect.objectContaining({
            name: 'Platform Team',
            manager_id: 'user-mgr-1',
          }),
        })
      );
    });
  });

  it.each(['', 'A'])(
    'blocks team creation for invalid team name %j',
    async (invalidName) => {
      render(<ProjectForm users={mockUsers} />);

      await fillStep1Basics();
      await advanceCreateFormToTeamStep();
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Create an initial team/i })
      );
      fireEvent.change(screen.getByLabelText(/Team Name/i), {
        target: { value: invalidName },
      });
      await pickComboboxOption(/Team Manager/i, 'Manager One (mgr1@alice.dev)');
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

      expect(
        await screen.findByText('Team name must be at least 2 characters.')
      ).toBeInTheDocument();
      expect(createProject).not.toHaveBeenCalled();
    }
  );

  it('blocks team creation when no manager is selected', async () => {
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    await advanceCreateFormToTeamStep();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial team/i })
    );
    fireEvent.change(screen.getByLabelText(/Team Name/i), {
      target: { value: 'Platform Team' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    expect(
      await screen.findByText('Please select a team manager.')
    ).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('does not offer inactive users in the initial team step', async () => {
    const inactiveManager: User = {
      ...mockUsers[1]!,
      id: 'inactive-manager',
      name: 'Inactive Manager',
      email: 'inactive@alice.dev',
      active: false,
    };
    render(<ProjectForm users={[...mockUsers, inactiveManager]} />);

    await fillStep1Basics();
    await advanceCreateFormToTeamStep();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Create an initial team/i })
    );

    const options = await getComboboxOptions(/Team Manager/i);
    expect(options).toHaveLength(3);
    expect(screen.queryByText(/Inactive Manager/)).not.toBeInTheDocument();
  });

  it('keeps creation successful when cache invalidation fails', async () => {
    const onSuccess = vi.fn();
    const onProjectUpdated = vi.fn();
    const cacheError = new Error('Cache invalidation failed.');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(createProject).mockResolvedValue(mockProject);
    vi.mocked(invalidateProjectDropdownCache).mockRejectedValue(cacheError);

    try {
      render(
        <ProjectForm
          users={mockUsers}
          onSuccess={onSuccess}
          onProjectUpdated={onProjectUpdated}
        />
      );

      await fillStep1Basics();
      await advanceCreateFormToTeamStep();
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

      expect(
        await screen.findByText(/Project "Project Alice" created/i)
      ).toBeInTheDocument();
      expect(invalidateProjectDropdownCache).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to invalidate project dropdown cache after project creation:',
        cacheError
      );
      expect(onProjectUpdated).toHaveBeenCalledWith(mockProject);
      expect(screen.queryByText(cacheError.message)).not.toBeInTheDocument();
      await waitFor(() => expect(onSuccess).toHaveBeenCalled(), {
        timeout: 2_000,
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not invalidate the project cache when creation fails', async () => {
    const onSuccess = vi.fn();
    const onProjectUpdated = vi.fn();
    vi.mocked(createProject).mockRejectedValue(
      new Error('Project creation failed.')
    );

    render(
      <ProjectForm
        users={mockUsers}
        onSuccess={onSuccess}
        onProjectUpdated={onProjectUpdated}
      />
    );

    await fillStep1Basics();
    await advanceCreateFormToTeamStep();
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    expect(
      await screen.findByText('Project creation failed.')
    ).toBeInTheDocument();
    expect(invalidateProjectDropdownCache).not.toHaveBeenCalled();
    expect(onProjectUpdated).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('populates fields from projectToEdit and updates correctly in edit mode', async () => {
    const onProjectUpdated = vi.fn();
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      name: 'Project Alice Updated',
    });

    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    expect(screen.getByLabelText(/Project Name/i)).toHaveValue('Project Alice');
    expect(screen.getByLabelText(/Project Key/i)).toHaveValue('ALICE');
    expect(screen.getByLabelText(/Description/i)).toHaveValue(
      'Project description details'
    );
    expect(screen.getByLabelText(/Project Owner/i)).toHaveValue(
      'Manager One (mgr1@alice.dev)'
    );
    expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2026-07-10');
    expect(screen.getByLabelText(/End Date/i)).toHaveValue('2026-08-10');

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(
      screen.queryByRole('checkbox', { name: /Create an initial sprint/i })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-123',
        {
          name: 'Project Alice Updated',
          key: 'ALICE',
          description: 'Project description details',
          owner_id: 'user-mgr-1',
          start_date: '2026-07-10',
          end_date: '2026-08-10',
          status: 'active',
          attributes_config: null,
          workflow_config: {
            work_item_types: ['Epic', 'Feature', 'Story', 'Task', 'Issue'],
          },
          jira_connection_id: null,
          jira_project_key: null,
          github_repo: null,
          github_token: null,
        },
        '2026-07-09T10:00:00Z'
      );
    });

    expect(
      await screen.findByText(/Project "Project Alice Updated" updated/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith({
      ...mockProject,
      name: 'Project Alice Updated',
    });
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ProjectForm users={mockUsers} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows Jira OAuth fields when checkbox is toggled with an existing connection', async () => {
    mockJiraApiFetch();

    render(<ProjectForm users={mockUsers} />);
    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));

    expect(
      await screen.findByRole('button', { name: /Connect Jira/i })
    ).toBeInTheDocument();

    const selects = await screen.findAllByTestId('ui-select');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });

    const projectSelect = (await screen.findAllByTestId('ui-select'))[1]!;
    fireEvent.change(projectSelect, { target: { value: 'TEST' } });
    expect(projectSelect).toHaveValue('TEST');
  });

  it('advances from Imports to Source Control without creating the project', async () => {
    mockJiraApiFetch();
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);
    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));
    const selects = await screen.findAllByTestId('ui-select');
    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });
    fireEvent.change((await screen.findAllByTestId('ui-select'))[1]!, {
      target: { value: 'TEST' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByRole('checkbox', { name: /^GitHub$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('submits project creation and calls Jira import endpoint when checkbox is checked', async () => {
    mockJiraApiFetch({ importedCount: 2 });
    vi.mocked(createProject).mockResolvedValue(mockProject);

    const onSuccess = vi.fn();
    render(<ProjectForm users={mockUsers} onSuccess={onSuccess} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));

    const selects = await screen.findAllByTestId('ui-select');
    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });

    const projectSelect = (await screen.findAllByTestId('ui-select'))[1]!;
    fireEvent.change(projectSelect, { target: { value: 'TEST' } });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /^GitHub$/i });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial sprint/i });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial team/i });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          jira_connection_id: 'conn-1',
          jira_project_key: 'TEST',
        })
      );
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/projects/proj-123/jira/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          timeoutMs: 90_000,
        }
      );
    });

    expect(
      await screen.findByText(/tasks successfully imported from Jira/i)
    ).toBeInTheDocument();
  });

  it('submits project creation with GitHub Repository URL when GitHub is enabled', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    fireEvent.change(screen.getByLabelText(/GitHub Repository URL/i), {
      target: { value: 'https://github.com/facebook/react' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial sprint/i });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial team/i });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          github_repo: 'facebook/react',
          github_token: null,
        })
      );
    });
  });

  it('renders Connect GitHub button and not connected status when no OAuth connection exists', async () => {
    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    expect(
      await screen.findByText(/Status: Not connected/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Connect GitHub/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Personal Access Token/i)
    ).not.toBeInTheDocument();
  });

  it('displays authenticated GitHub account identity and status when OAuth is connected', async () => {
    mockJiraApiFetch({
      connections: [],
      githubConnections: [mockGithubConnection],
    });

    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    expect(await screen.findByText('@octocat')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Switch Account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Disconnect/i })
    ).toBeInTheDocument();
  });

  it('automatically splits GitHub Repository URL into owner and repository name', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    fireEvent.change(screen.getByLabelText(/GitHub Repository URL/i), {
      target: { value: 'https://github.com/facebook/react.git' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial sprint/i });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('checkbox', { name: /Create an initial team/i });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          github_repo: 'facebook/react',
        })
      );
    });
  });

  it('omits blank github_token on edit so existing PAT is unchanged', async () => {
    const onProjectUpdated = vi.fn();
    const projectWithGithub = {
      ...mockProject,
      github_repo: 'facebook/react',
      has_github_token: true,
    };
    vi.mocked(updateProject).mockResolvedValue(projectWithGithub);

    render(
      <ProjectForm
        projectToEdit={projectWithGithub}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-123',
        expect.objectContaining({
          github_repo: 'facebook/react',
          github_token: undefined,
        }),
        '2026-07-09T10:00:00Z'
      );
    });
  });

  it('validates that end date cannot be a past date during creation', async () => {
    render(<ProjectForm users={mockUsers} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'ALICE' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('validates that end date cannot be before start date', async () => {
    render(<ProjectForm users={mockUsers} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'ALICE' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const earlierDate = new Date(futureDate);
    earlierDate.setDate(futureDate.getDate() - 1);
    const earlierDateStr = earlierDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: futureDateStr },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: earlierDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date must be on or after the Start Date/i)
    ).toBeInTheDocument();
  });

  it('validates that changed start date in edit mode cannot be a past date', async () => {
    const onProjectUpdated = vi.fn();
    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/Start Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('validates that changed end date in edit mode cannot be a past date', async () => {
    const onProjectUpdated = vi.fn();
    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('allows saving in edit mode if existing past dates are not changed', async () => {
    const onProjectUpdated = vi.fn();
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      name: 'Project Alice Updated',
    });

    const oldProject = {
      ...mockProject,
      start_date: '2020-01-01',
      end_date: '2020-02-01',
    };

    render(
      <ProjectForm
        projectToEdit={oldProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalled();
    });
  });
});
