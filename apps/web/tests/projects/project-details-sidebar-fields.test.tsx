import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { parseProjectDetailsTab } from '@/lib/search-params';
import { ProjectDetailsWorkspace } from '@/app/projects/_components/project-details/project-details-workspace';
import { ProjectFieldsWorkspace } from '@/app/projects/_components/project-details/project-fields-workspace';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

vi.mock('next/navigation', () => {
  let searchParamsValue = new URLSearchParams();
  return {
    useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/projects/project-1',
    useSearchParams: () => searchParamsValue,
    __setSearchParams: (params: URLSearchParams) => {
      searchParamsValue = params;
    },
  };
});

vi.mock(
  '@/app/projects/_components/project-details/project-summary-banner',
  () => ({
    ProjectSummaryBanner: () => (
      <div data-testid="project-summary-banner">Project Banner</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-details-tab',
  () => ({
    ProjectDetailsTab: () => (
      <div data-testid="project-details-tab">Details Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-members-tab',
  () => ({
    ProjectMembersTab: () => (
      <div data-testid="project-members-tab">Members Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-teams-panel',
  () => ({
    ProjectTeamsPanel: () => (
      <div data-testid="project-teams-panel">Teams Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-integrations-tab',
  () => ({
    ProjectIntegrationsTab: () => (
      <div data-testid="project-integrations-tab">Integrations Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/board-designer-workspace',
  () => ({
    BoardDesignerWorkspace: () => (
      <div data-testid="board-designer-workspace">Board Designer</div>
    ),
  })
);

vi.mock('@/app/work-items/_components/work-items-workspace', () => ({
  default: () => (
    <div data-testid="work-items-workspace">Work Items Content</div>
  ),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProjectFieldsConfig: vi.fn().mockResolvedValue({}),
}));

const mockProject: Project = {
  id: 'project-1',
  name: 'Mobile App',
  key: 'MOB',
  description: 'Mobile iOS and Android app',
  status: 'active',
  start_date: null,
  end_date: null,
  owner_id: 'user-manager-1',
  created_by: 'user-admin-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  updated_by: null,
  jira_project_key: null,
  jira_connection_id: null,
  github_repo: null,
  logo_url: null,
  cover_picture: null,
  attributes_config: {
    type: 'object',
    properties: {
      moscowRating: {
        type: 'string',
        title: 'MoSCoW Rating',
        enum: ['Must', 'Should', 'Could', "Won't"],
      },
    },
  },
  workflow_config: null,
};

describe('parseProjectDetailsTab', () => {
  it('parses "fields" tab parameter', () => {
    expect(parseProjectDetailsTab('fields')).toBe('fields');
  });

  it('parses standard tab parameters', () => {
    expect(parseProjectDetailsTab('details')).toBe('details');
    expect(parseProjectDetailsTab('members')).toBe('members');
    expect(parseProjectDetailsTab('teams')).toBe('teams');
    expect(parseProjectDetailsTab('work-items')).toBe('work-items');
    expect(parseProjectDetailsTab('integrations')).toBe('integrations');
    expect(parseProjectDetailsTab('board')).toBe('board');
  });

  it('falls back to "details" for unknown or empty values', () => {
    expect(parseProjectDetailsTab(null)).toBe('details');
    expect(parseProjectDetailsTab(undefined)).toBe('details');
    expect(parseProjectDetailsTab('non-existent')).toBe('details');
  });
});

describe('ProjectDetailsWorkspace sidebar and banner isolation', () => {
  it('renders the board designer for ?tab=board', async () => {
    const navigation =
      (await import('next/navigation')) as unknown as typeof import('next/navigation') & {
        // eslint-disable-next-line no-unused-vars -- mock helper signature
        __setSearchParams: (params: URLSearchParams) => void;
      };
    navigation.__setSearchParams(new URLSearchParams('tab=board'));

    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-manager-1"
        currentUserRole="manager"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          listView: 'flat',
          tab: 'active',
        }}
        teams={{
          items: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          status: 'active',
        }}
      />
    );

    expect(screen.getByTestId('board-designer-workspace')).toBeInTheDocument();
    navigation.__setSearchParams(new URLSearchParams());
  });

  it('renders all 7 navigation options in the sidebar', () => {
    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-manager-1"
        currentUserRole="manager"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          listView: 'flat',
          tab: 'active',
        }}
        teams={{
          items: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          status: 'active',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: /details/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /members/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /teams/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /work items/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /integrations/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fields/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /board/i })).toBeInTheDocument();
  });

  it('renders ProjectSummaryBanner when Details tab is active', () => {
    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-manager-1"
        currentUserRole="manager"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          listView: 'flat',
          tab: 'active',
        }}
        teams={{
          items: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          status: 'active',
        }}
      />
    );

    expect(screen.getByTestId('project-summary-banner')).toBeInTheDocument();
    expect(screen.getByTestId('project-details-tab')).toBeInTheDocument();
  });
});

describe('ProjectFieldsWorkspace component', () => {
  it('renders heading, description, and action buttons', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    expect(
      screen.getByRole('heading', { name: /dynamic fields/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /load template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /beautify/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /validate/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /generate with alice/i })
    ).toBeInTheDocument();
  });

  it('renders configured field cards from project attributes_config', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    expect(screen.getByText('key: moscowRating')).toBeInTheDocument();
    expect(screen.getByText('Must')).toBeInTheDocument();
    expect(screen.getByText('Should')).toBeInTheDocument();
  });

  it('shows read-only banner and disables editing when user is not a manager or admin', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={false} />
    );

    expect(
      screen.getByText(
        /you have view-only access to this project's dynamic fields configuration/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /beautify/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /load template/i })
    ).toBeDisabled();
  });

  it('allows loading template and validates syntax', () => {
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Click load template
    const loadBtn = screen.getByRole('button', { name: /load template/i });
    fireEvent.click(loadBtn);

    // Validate button
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);

    expect(
      screen.getByText(/schema is syntactically valid/i)
    ).toBeInTheDocument();
  });
});
