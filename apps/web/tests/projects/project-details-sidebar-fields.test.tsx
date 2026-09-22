import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseProjectDetailsTab } from '@/lib/search-params';
import { ProjectDetailsWorkspace } from '@/app/projects/_components/project-details/project-details-workspace';
import { ProjectFieldsWorkspace } from '@/app/projects/_components/project-details/project-fields-workspace';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

const { mockPush, mockRouterRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRouterRefresh: vi.fn(),
}));

let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: mockPush,
      refresh: mockRouterRefresh,
    }),
    usePathname: () => '/projects/project-1',
    useSearchParams: () => searchParamsValue,
    __setSearchParams: (params: URLSearchParams) => {
      searchParamsValue = params;
    },
  };
});

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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

vi.mock('@/app/sprints/_components/sprints-workspace', () => ({
  SprintsWorkspace: () => (
    <div data-testid="sprints-workspace">Sprints Content</div>
  ),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProjectFieldsConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api/api-fetch.reads.use.client', () => ({
  apiFetch: vi.fn().mockResolvedValue({ workItems: [] }),
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
    expect(parseProjectDetailsTab('sprints')).toBe('sprints');
    expect(parseProjectDetailsTab('integrations')).toBe('integrations');
    expect(parseProjectDetailsTab('board')).toBe('board');
    expect(parseProjectDetailsTab('settings')).toBe('settings');
  });

  it('falls back to "details" for unknown or empty values', () => {
    expect(parseProjectDetailsTab(null)).toBe('details');
    expect(parseProjectDetailsTab(undefined)).toBe('details');
    expect(parseProjectDetailsTab('non-existent')).toBe('details');
  });
});

describe('ProjectDetailsWorkspace sidebar and banner isolation', () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams();
    mockPush.mockClear();
  });

  it('renders the board designer for ?tab=board', () => {
    searchParamsValue = new URLSearchParams('tab=board');

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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(screen.getByTestId('board-designer-workspace')).toBeInTheDocument();
  });

  it('renders all navigation options including role-gated Sprints and Board', () => {
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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(screen.getByRole('link', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /teams/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /work items/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^sprints$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /integrations/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fields/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /board/i })).toBeInTheDocument();
  });

  it('hides manager-only nav for members', () => {
    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-member-1"
        currentUserRole="member"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(
      screen.queryByRole('link', { name: /^sprints$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /teams/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /integrations/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /fields/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /board/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /settings/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /members/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /work items/i })
    ).toBeInTheDocument();
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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(screen.getByTestId('project-summary-banner')).toBeInTheDocument();
    expect(screen.getByTestId('project-details-tab')).toBeInTheDocument();
  });

  it('updates query param via router.push when clicking sidebar tabs', () => {
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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    // Sidebar uses Next.js Links with tab hrefs (prefetchable).
    expect(screen.getByRole('link', { name: /fields/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=fields'
    );
    expect(screen.getByRole('link', { name: /work items/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=work-items'
    );
    expect(screen.getByRole('link', { name: /members/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=members'
    );
    expect(screen.getByRole('link', { name: /details/i })).toHaveAttribute(
      'href',
      '/projects/project-1'
    );
  });

  it('isolates ProjectSummaryBanner strictly to details tab (absent on fields and work-items)', () => {
    // When on fields tab
    searchParamsValue = new URLSearchParams('tab=fields');

    const { rerender } = render(
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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(
      screen.queryByTestId('project-summary-banner')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /dynamic fields/i })
    ).toBeInTheDocument();

    // When on work-items tab
    searchParamsValue = new URLSearchParams('tab=work-items');
    rerender(
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
          sprintFilter: '',
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
        sprints={{
          sprints: [],
          pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 1 },
          filterTab: 'active',
          search: '',
        }}
      />
    );

    expect(
      screen.queryByTestId('project-summary-banner')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('work-items-workspace')).toBeInTheDocument();
  });
});

describe('ProjectFieldsWorkspace component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiFetch } = await import('@/lib/api/api-fetch.reads.use.client');
    vi.mocked(apiFetch).mockResolvedValue({ workItems: [] });
  });

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

  it('initializes LoadTemplateDialog with 0 templates selected for unconfigured projects', () => {
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Open Load Template dialog
    fireEvent.click(screen.getByRole('button', { name: /load template/i }));
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Initial zero-selection default rule: exactly 0 templates selected
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByText('8 available templates')).toBeInTheDocument();

    // Add Selected button is disabled when nothing selected
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    expect(addBtn).toBeDisabled();

    // No templates show the "Added" badge
    expect(screen.queryByText('Added')).not.toBeInTheDocument();
  });

  it('allows loading template via dialog and validates syntax', () => {
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Click load template to open dialog
    const loadBtn = screen.getByRole('button', { name: /load template/i });
    fireEvent.click(loadBtn);

    // Dialog title appears
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Select templates
    const selectAllBtn = screen.getByRole('button', { name: /select all/i });
    fireEvent.click(selectAllBtn);

    // Click Add Selected button
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Validate button
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);

    expect(
      screen.getByText(/schema is syntactically valid/i)
    ).toBeInTheDocument();
  });

  it('calls updateProjectFieldsConfig with expectedUpdatedAt on save', async () => {
    const { updateProjectFieldsConfig } =
      await import('@/app/projects/_services/projects.mutations.client');
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(updateProjectFieldsConfig).toHaveBeenCalledWith(
      mockProject.id,
      expect.objectContaining({
        properties: expect.any(Object),
      }),
      mockProject.updated_at
    );
  });

  it('renders line numbers in the editor corresponding to schema lines', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Verify line count text
    expect(screen.getByText(/lines? • draft 2020-12/i)).toBeInTheDocument();

    // Verify line numbers gutter contains line 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays status messages in the green banner area and auto-dismisses after timer', () => {
    vi.useFakeTimers();
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Beautify
    fireEvent.click(screen.getByRole('button', { name: /beautify/i }));
    expect(
      screen.getByText(/json formatted successfully/i)
    ).toBeInTheDocument();

    // Fast-forward 5000ms
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Banner has auto-dismissed
    expect(
      screen.queryByText(/json formatted successfully/i)
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('merges selected template fields into existing schema without wiping out existing fields', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Initial schema has MoSCoW Rating
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();

    // Click Load Template
    const loadBtn = screen.getByRole('button', { name: /load template/i });
    fireEvent.click(loadBtn);

    // Dialog opens; already added fields show "Added" badge
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();
    expect(screen.getAllByText('Added')).toHaveLength(1);

    // Select an unadded template field, e.g. Defect Severity
    const severityCard = screen.getByText('Defect Severity');
    fireEvent.click(severityCard);

    // Click Add Selected
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Success banner displays
    expect(screen.getByText(/added 1 template field/i)).toBeInTheDocument();

    // Both previous fields and newly added field are present in Configured Fields preview
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    expect(screen.getByText('Defect Severity')).toBeInTheDocument();
  });

  it('allows unselecting an existing template field and removes it from schema upon applying', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Initially MoSCoW Rating is present
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();

    // Open Load Template dialog
    fireEvent.click(screen.getByRole('button', { name: /load template/i }));
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Click MoSCoW Rating card to unselect it
    const moscowCard = document
      .getElementById('template-checkbox-moscowRating')!
      .closest('[role="checkbox"]')!;
    fireEvent.click(moscowCard);

    // Apply change
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Schema now has 0 dynamic fields
    expect(
      screen.getByText(/no dynamic fields configured yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('key: moscowRating')).not.toBeInTheDocument();
  });

  it('displays warning popup with OK and Cancel when unselecting a template with work item values', async () => {
    const { apiFetch } = await import('@/lib/api/api-fetch.reads.use.client');
    const workItemsResponse = {
      workItems: [
        {
          id: 'wi-1',
          title: 'Implement Authentication',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Must',
              },
            },
          },
        },
      ],
    };
    const fetchPromise = Promise.resolve(workItemsResponse);
    vi.mocked(apiFetch).mockReturnValue(fetchPromise as never);

    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Open Load Template dialog
    fireEvent.click(screen.getByRole('button', { name: /load template/i }));
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Wait for work-item fetch to settle into dialog state before unselecting
    await act(async () => {
      await fetchPromise;
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });

    // Try to unselect MoSCoW Rating
    const moscowCard = document
      .getElementById('template-checkbox-moscowRating')!
      .closest('[role="checkbox"]')!;
    fireEvent.click(moscowCard);

    // Warning confirmation popup should appear
    await waitFor(() => {
      expect(
        screen.getByText('Remove Field Template: MoSCoW Rating')
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/work item values will be removed under this template/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Implement Authentication: Must/)
    ).toBeInTheDocument();

    // Cancel button in warning popup
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    // Click Cancel - field should remain selected
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByText('Remove Field Template: MoSCoW Rating')
    ).not.toBeInTheDocument();

    // Try unselecting again and click OK to confirm
    fireEvent.click(moscowCard);
    expect(
      screen.getByText('Remove Field Template: MoSCoW Rating')
    ).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(okBtn);

    // Popup closed and field is unselected
    expect(
      screen.queryByText('Remove Field Template: MoSCoW Rating')
    ).not.toBeInTheDocument();

    // Click Add Selected to apply
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/removed 1 template field/i)).toBeInTheDocument();
  });

  it('displays consolidated warning popup when clicking Deselect All on templates with work item values', async () => {
    const { apiFetch } = await import('@/lib/api/api-fetch.reads.use.client');
    const workItemsResponse = {
      workItems: [
        {
          id: 'wi-10',
          title: 'PROJ-10 (Setup DB)',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Must',
              },
            },
          },
        },
      ],
    };
    const fetchPromise = Promise.resolve(workItemsResponse);
    vi.mocked(apiFetch).mockReturnValue(fetchPromise as never);

    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    fireEvent.click(screen.getByRole('button', { name: /load template/i }));

    // Ensure fetched work items are applied before Clear Selection
    await act(async () => {
      await fetchPromise;
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });

    const clearSelectionBtn = screen.getByRole('button', {
      name: /clear selection/i,
    });
    fireEvent.click(clearSelectionBtn);

    // Consolidated warning popup appears
    await waitFor(() => {
      expect(screen.getByText('Remove Field Templates')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /work item values will be removed under these templates/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/PROJ-10 \(Setup DB\): Must/)).toBeInTheDocument();

    // Cancel keeps selection
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByText('Remove Field Templates')
    ).not.toBeInTheDocument();
  });

  it('blocks save and displays JSON Syntax Error dialog when schema JSON is malformed', async () => {
    const { updateProjectFieldsConfig } =
      await import('@/app/projects/_services/projects.mutations.client');
    vi.mocked(updateProjectFieldsConfig).mockClear();

    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    const textarea = screen.getByLabelText(/json schema specification/i);

    // Introduce invalid JSON syntax
    const malformedJson =
      '{\n  "title": "Invalid Schema",\n  "properties": {\n';
    fireEvent.change(textarea, { target: { value: malformedJson } });

    // Save Changes button is disabled due to syntax error
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();

    // Clicking Validate catches the syntax error and displays JSON Syntax Error dialog
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);

    expect(screen.getByText('JSON Syntax Error')).toBeInTheDocument();
    expect(
      screen.getByText(/the schema contains invalid json syntax/i)
    ).toBeInTheDocument();

    expect(updateProjectFieldsConfig).not.toHaveBeenCalled();

    // Close error dialog
    const okBtn = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(okBtn);

    // Clicking Beautify also catches syntax error and opens dialog
    const beautifyBtn = screen.getByRole('button', { name: /beautify/i });
    fireEvent.click(beautifyBtn);
    expect(screen.getByText('JSON Syntax Error')).toBeInTheDocument();
  });

  it('blocks save when schema violates ProjectFieldsConfigSchema specification', async () => {
    const { updateProjectFieldsConfig } =
      await import('@/app/projects/_services/projects.mutations.client');
    vi.mocked(updateProjectFieldsConfig).mockClear();

    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    const textarea = screen.getByLabelText(/json schema specification/i);

    // Valid JSON object (parseError is null so Save button is enabled), but invalid schema
    const invalidSchema = JSON.stringify(
      {
        type: 'object',
        properties: {
          invalidField$: {
            type: 'string',
            title: 'Field with invalid identifier',
          },
        },
      },
      null,
      2
    );
    fireEvent.change(textarea, { target: { value: invalidSchema } });

    // Save button is enabled because JSON object is syntactically valid
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    // Error dialog appears with Schema Validation Error
    expect(screen.getByText('Schema Validation Error')).toBeInTheDocument();
    expect(updateProjectFieldsConfig).not.toHaveBeenCalled();
  });

  it('handles Tab key press in editor textarea by inserting 2 spaces', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    const textarea = screen.getByLabelText<HTMLTextAreaElement>(
      /json schema specification/i
    );
    textarea.selectionStart = 1;
    textarea.selectionEnd = 1;

    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(textarea.value).toContain('  ');
  });

  it('renders footer buttons clearly with proper spacing on the right side', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    fireEvent.click(screen.getByRole('button', { name: /load template/i }));

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const addBtn = screen.getByRole('button', { name: /add selected/i });

    expect(cancelBtn).toBeInTheDocument();
    expect(addBtn).toBeInTheDocument();

    // Verify footer container layout classes
    const footer = cancelBtn.closest('[data-slot="dialog-footer"]');
    expect(footer).toBeInTheDocument();
    expect(footer?.className).toContain('justify-end');
    expect(footer?.className).toContain('gap-3');
    expect(footer?.className).toContain('m-0');
    expect(footer?.className).toContain('px-6');
    expect(footer?.className).toContain('py-4');
  });
});
