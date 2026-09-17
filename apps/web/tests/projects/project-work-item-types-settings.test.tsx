import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSettingsTab } from '@/app/projects/_components/project-details/project-settings-tab';
import { JiraImportDialog } from '@/app/projects/_components/project-details/jira-import-dialog';
import { WorkItemForm } from '@/app/work-items/_components/work-item-form/work-item-form';
import {
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import {
  previewJiraImport,
  importJiraIssues,
} from '@/app/projects/_services/projects.jira.mutations.client';
import { resolveProjectHierarchy } from '@repo/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/projects/project-1',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProject: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.jira.mutations.client', () => ({
  previewJiraImport: vi.fn(),
  importJiraIssues: vi.fn(),
}));

vi.mock('@/lib/optimistic-lock/run-locked-mutation', () => ({
  runLockedMutationOrThrow: vi.fn(async ({ mutate }) => mutate()),
}));

const mockProject: Project = {
  id: 'proj-1',
  name: 'Alpha Project',
  key: 'ALPHA',
  description: 'Test project description',
  status: 'active',
  owner_id: 'user-1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  attributes_config: null,
  workflow_config: {
    work_item_types: ['Epic', 'Story', 'Task', 'Issue'],
  } as unknown as Project['workflow_config'],
  jira_connection_id: 'conn-1',
  jira_project_key: 'JIRA_ALPHA',
  github_repo: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  cover_picture: null,
  logo_url: null,
};

describe('ProjectSettingsTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 work item types in settings controls', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    expect(screen.getByText('Allowed Work-Item Types')).toBeInTheDocument();
    expect(screen.getByText('Epic')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Issue')).toBeInTheDocument();

    // Checkboxes for configured types are checked (Feature was omitted in mockProject)
    const epicCheckbox = screen.getByRole('checkbox', { name: /epic/i });
    const featureCheckbox = screen.getByRole('checkbox', { name: /feature/i });
    expect(epicCheckbox).toBeChecked();
    expect(featureCheckbox).not.toBeChecked();
  });

  it('shows warning alert when an existing type is removed', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    // Uncheck Story
    const storyCheckbox = screen.getByRole('checkbox', { name: /story/i });
    fireEvent.click(storyCheckbox);

    expect(
      screen.getByText(/Work items will be migrated/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /will cause all existing items of those types in this project to fall back/i
      )
    ).toBeInTheDocument();
  });

  it('disables save button when all types are unselected', () => {
    render(
      <ProjectSettingsTab
        project={{
          ...mockProject,
          workflow_config: {
            work_item_types: ['Task'],
          } as unknown as Project['workflow_config'],
        }}
        isManagerOrAdmin={true}
      />
    );

    const taskCheckbox = screen.getByRole('checkbox', { name: /task/i });
    fireEvent.click(taskCheckbox);

    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    expect(saveButton).toBeDisabled();
  });

  it('calls updateProject with the updated work_item_types when saved', async () => {
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      workflow_config: {
        work_item_types: ['Epic', 'Feature', 'Story', 'Task', 'Issue'],
      } as unknown as Project['workflow_config'],
    });

    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    // Add Feature
    const featureCheckbox = screen.getByRole('checkbox', { name: /feature/i });
    fireEvent.click(featureCheckbox);

    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          workflow_config: expect.objectContaining({
            work_item_types: ['Epic', 'Feature', 'Story', 'Task', 'Issue'],
          }),
        }),
        '2026-01-01T00:00:00Z'
      );
    });
  });

  it('shows read-only view when user is not a manager or admin', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={false} />
    );

    expect(
      screen.getByText(
        /Only Project Managers and Administrators can configure project settings/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Save Settings/i })
    ).not.toBeInTheDocument();
  });
});

describe('WorkItemForm Type Scoping', () => {
  it('restricts work item type dropdown to project allowed types', () => {
    const projectWithSingleType: Project = {
      ...mockProject,
      id: 'proj-single',
      workflow_config: {
        work_item_types: ['Issue'],
      } as unknown as Project['workflow_config'],
    };

    render(
      <WorkItemForm
        onSuccess={vi.fn()}
        projects={[projectWithSingleType]}
        lockProject={true}
        projectMembers={[]}
      />
    );

    // Form automatically locks and selects the single available type
    expect(screen.getAllByText('Issue').length).toBeGreaterThan(0);
  });
});

describe('JiraImportDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans Jira project and displays discovered issue types for mapping', async () => {
    vi.mocked(previewJiraImport).mockResolvedValue({
      issues: [
        { key: 'JIRA-1', title: 'Epic 1', type: 'Epic' },
        { key: 'JIRA-2', title: 'Story 1', type: 'Story' },
        { key: 'JIRA-3', title: 'Bug 1', type: 'Bug' },
      ],
      issueTypes: ['Epic', 'Story', 'Bug'],
    });

    render(
      <JiraImportDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
        onImportSuccess={vi.fn()}
      />
    );

    expect(
      await screen.findByText('1. Issue Type Mappings')
    ).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('2. ALICE Target Hierarchy')).toBeInTheDocument();
  });

  it('submits Jira import with configured type mappings and hierarchy', async () => {
    vi.mocked(previewJiraImport).mockResolvedValue({
      issues: [{ key: 'JIRA-1', title: 'Task 1', type: 'Task' }],
      issueTypes: ['Task'],
    });
    vi.mocked(importJiraIssues).mockResolvedValue({ importedCount: 1 });

    const onImportSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <JiraImportDialog
        open={true}
        onOpenChange={onOpenChange}
        project={mockProject}
        onImportSuccess={onImportSuccess}
      />
    );

    expect(
      await screen.findByText('1. Issue Type Mappings')
    ).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /Start Import/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(importJiraIssues).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          typeMappings: expect.objectContaining({
            Task: expect.objectContaining({
              action: 'map',
              targetType: 'Task',
            }),
          }),
          hierarchy: expect.any(Array),
        })
      );
      expect(onImportSuccess).toHaveBeenCalledWith(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange(false) when Cancel button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <JiraImportDialog
        open={true}
        onOpenChange={onOpenChange}
        project={mockProject}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Hierarchy Resolution Rules', () => {
  it('follows fixed system hierarchy (Epic -> Story -> Task -> Issue) even when Feature is an allowed type', () => {
    const { parentToChild, childToParent } = resolveProjectHierarchy([
      'Epic',
      'Feature',
      'Story',
      'Task',
      'Issue',
    ]);

    // Epic -> Story (Feature is NOT placed between Epic and Story in fixed system hierarchy)
    expect(parentToChild.Epic).toBe('Story');
    expect(parentToChild.Story).toBe('Task');
    expect(parentToChild.Task).toBe('Issue');
    expect(parentToChild.Feature).toBeUndefined();

    expect(childToParent.Story).toBe('Epic');
    expect(childToParent.Task).toBe('Story');
    expect(childToParent.Issue).toBe('Task');
    expect(childToParent.Feature).toBeUndefined();
  });

  it('applies custom hierarchy strictly when configured during Jira import', () => {
    const customJiraHierarchy = {
      Epic: 'Feature',
      Feature: 'Story',
      Story: 'Task',
      Task: 'Issue',
    };

    const { parentToChild, childToParent } = resolveProjectHierarchy(
      ['Epic', 'Feature', 'Story', 'Task', 'Issue'],
      customJiraHierarchy
    );

    expect(parentToChild.Epic).toBe('Feature');
    expect(parentToChild.Feature).toBe('Story');
    expect(parentToChild.Story).toBe('Task');
    expect(parentToChild.Task).toBe('Issue');

    expect(childToParent.Feature).toBe('Epic');
    expect(childToParent.Story).toBe('Feature');
    expect(childToParent.Task).toBe('Story');
    expect(childToParent.Issue).toBe('Task');
  });
});
