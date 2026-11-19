import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowImportDialog } from '@/app/projects/_components/project-details/workflow-import-dialog';

const DEFAULT_WORKFLOW_ID = 'wf-default';

const { apiFetchMock, getProjectWorkflowConfigMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  getProjectWorkflowConfigMock: vi.fn(),
}));

vi.mock('@/lib/api/api-fetch.reads.use.client', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('@/app/projects/_services/projects.workflow-config.client', () => ({
  getProjectWorkflowConfig: getProjectWorkflowConfigMock,
}));

const currentProjectId = '11111111-1111-4111-8111-111111111111';
const projectAId = '22222222-2222-4222-8222-222222222222';
const projectBId = '33333333-3333-4333-8333-333333333333';

function mockWorkflowConfigResponse(
  workflows: readonly { id: string; title: string }[],
  defaultWorkflowId = workflows[0]?.id ?? DEFAULT_WORKFLOW_ID
) {
  return {
    config: {
      schemaVersion: 1 as const,
      defaultWorkflowId,
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        title: workflow.title,
        description: '',
        forkedFromId: null,
        typeBindings: [] as const,
        graph: { states: [], edges: [] },
        layout: { nodes: {}, edges: {} },
        resolutionPresets: [],
      })),
    },
    usedFallback: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockProjectsList() {
  apiFetchMock.mockResolvedValue({
    projects: [
      {
        id: currentProjectId,
        name: 'Current',
        key: 'CUR',
      },
      {
        id: projectAId,
        name: 'Alpha',
        key: 'ALP',
      },
      {
        id: projectBId,
        name: 'Beta',
        key: 'BET',
      },
    ],
    totalCount: 3,
    page: 1,
    limit: 100,
    totalPages: 1,
  });
}

async function selectSourceProject(label: RegExp) {
  await waitFor(() => {
    expect(screen.getByTestId('workflow-import-source-project')).toBeEnabled();
  });
  fireEvent.click(screen.getByTestId('workflow-import-source-project'));
  fireEvent.click(screen.getByRole('option', { name: label }));
}

describe('WorkflowImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectsList();
  });

  it('shows the auth-drop notice after a source workflow is selected', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      mockWorkflowConfigResponse([
        { id: DEFAULT_WORKFLOW_ID, title: 'Default' },
      ])
    );

    const onImport = vi.fn();
    render(
      <WorkflowImportDialog
        open
        onOpenChange={vi.fn()}
        currentProjectId={currentProjectId}
        onImport={onImport}
      />
    );

    await selectSourceProject(/Alpha \(ALP\)/i);

    await waitFor(() => {
      expect(
        screen.getByTestId('workflow-import-auth-notice')
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId('workflow-import-title')).toHaveValue(
      'Default (import)'
    );
  });

  it('submits title, markAsDefault, and source ids', async () => {
    getProjectWorkflowConfigMock.mockResolvedValue(
      mockWorkflowConfigResponse([{ id: 'wf-source', title: 'Kanban' }])
    );

    const onImport = vi.fn();
    render(
      <WorkflowImportDialog
        open
        onOpenChange={vi.fn()}
        currentProjectId={currentProjectId}
        onImport={onImport}
      />
    );

    await selectSourceProject(/Alpha \(ALP\)/i);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-import-title')).toHaveValue(
        'Kanban (import)'
      );
    });

    fireEvent.change(screen.getByTestId('workflow-import-title'), {
      target: { value: 'Copied Kanban' },
    });
    fireEvent.click(screen.getByTestId('workflow-import-mark-default'));
    fireEvent.click(screen.getByTestId('workflow-import-submit'));

    expect(onImport).toHaveBeenCalledWith({
      sourceProjectId: projectAId,
      sourceWorkflowId: 'wf-source',
      title: 'Copied Kanban',
      markAsDefault: true,
    });
  });

  it('reuses cached workflows when switching back to a previous project', async () => {
    getProjectWorkflowConfigMock
      .mockResolvedValueOnce(
        mockWorkflowConfigResponse([{ id: 'wf-a', title: 'Alpha flow' }])
      )
      .mockResolvedValueOnce(
        mockWorkflowConfigResponse([{ id: 'wf-b', title: 'Beta flow' }])
      );

    render(
      <WorkflowImportDialog
        open
        onOpenChange={vi.fn()}
        currentProjectId={currentProjectId}
        onImport={vi.fn()}
      />
    );

    await selectSourceProject(/Alpha \(ALP\)/i);
    await waitFor(() => {
      expect(screen.getByTestId('workflow-import-title')).toHaveValue(
        'Alpha flow (import)'
      );
    });

    await selectSourceProject(/Beta \(BET\)/i);
    await waitFor(() => {
      expect(screen.getByTestId('workflow-import-title')).toHaveValue(
        'Beta flow (import)'
      );
    });

    await selectSourceProject(/Alpha \(ALP\)/i);
    await waitFor(() => {
      expect(screen.getByTestId('workflow-import-title')).toHaveValue(
        'Alpha flow (import)'
      );
    });

    expect(getProjectWorkflowConfigMock).toHaveBeenCalledTimes(2);
  });
});
