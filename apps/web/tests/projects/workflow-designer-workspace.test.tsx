import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import { WorkflowDesignerWorkspace } from '@/app/projects/_components/project-details/workflow-designer-workspace';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import {
  deleteProjectWorkflow,
  forkProjectWorkflow,
  putProjectWorkflowConfig,
  setDefaultProjectWorkflow,
} from '@/app/projects/_services/projects.workflow-config.client';
import { projectFactory } from '../factories/project.factory';

function asWorkflowConfig(
  config: ReturnType<typeof createSeededDefaultWorkflowConfig>
): Project['workflow_config'] {
  return config as unknown as Project['workflow_config'];
}

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('@/app/projects/_services/projects.workflow-config.client', () => ({
  putProjectWorkflowConfig: vi.fn(),
  forkProjectWorkflow: vi.fn(),
  setDefaultProjectWorkflow: vi.fn(),
  deleteProjectWorkflow: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@repo/ui/components/ui/flow-canvas', () => ({
  FlowCanvas: ({
    children,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
  }: {
    readonly children?: React.ReactNode;
    // eslint-disable-next-line no-unused-vars -- FlowCanvas prop shape
    readonly onNodeClick?: (event: unknown, node: { id: string }) => void;
    // eslint-disable-next-line no-unused-vars -- FlowCanvas prop shape
    readonly onEdgeClick?: (event: unknown, edge: { id: string }) => void;
    readonly onPaneClick?: () => void;
  }) => (
    <div data-testid="flow-canvas">
      <button
        type="button"
        data-testid="select-state-new"
        onClick={() => onNodeClick?.(null, { id: 'New' })}
      >
        Select New
      </button>
      <button
        type="button"
        data-testid="select-edge-0"
        onClick={() => onEdgeClick?.(null, { id: 'e-New-to-ToDo' })}
      >
        Select edge
      </button>
      <button type="button" data-testid="clear-selection" onClick={onPaneClick}>
        Clear
      </button>
      {children}
    </div>
  ),
  ReactFlowProvider: ({
    children,
  }: {
    readonly children?: React.ReactNode;
  }) => <>{children}</>,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  // eslint-disable-next-line no-unused-vars
  useConnection: (selector: (connection: { inProgress: boolean }) => unknown) =>
    selector({ inProgress: false }),
  useStore: (
    // eslint-disable-next-line no-unused-vars
    selector: (state: { edges: unknown[] }) => unknown,
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    _equalityFn?: unknown
  ) => selector({ edges: [] }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

describe('WorkflowDesignerWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockReset();
  });

  it('renders the seeded default workflow when config is null', () => {
    // Arrange
    const project = projectFactory.build({
      workflow_config: null,
    });

    // Act
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );

    // Assert
    expect(
      screen.getByTestId('workflow-designer-workspace')
    ).toBeInTheDocument();
    expect(screen.getByTestId('flow-canvas')).toBeInTheDocument();
    expect(screen.getByText(/using the default workflow/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('saves the envelope via putProjectWorkflowConfig', async () => {
    // Arrange
    const seeded = createSeededDefaultWorkflowConfig();
    const project = projectFactory.build({
      workflow_config: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(putProjectWorkflowConfig).mockResolvedValue({
      config: seeded,
      usedFallback: false,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Assert
    await waitFor(() => {
      expect(putProjectWorkflowConfig).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({
          schemaVersion: 1,
          defaultWorkflowId: seeded.defaultWorkflowId,
        }),
        '2026-01-01T00:00:00.000Z',
        undefined
      );
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('opens state settings when a canvas node is selected', () => {
    const project = projectFactory.build({ workflow_config: null });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-state-new'));
    expect(screen.getByTestId('workflow-settings-state')).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
  });

  it('exposes data-dirty for chat context when the fallback envelope is shown', () => {
    const project = projectFactory.build({ workflow_config: null });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    expect(screen.getByTestId('workflow-designer-workspace')).toHaveAttribute(
      'data-dirty',
      'true'
    );
  });

  it('adds a state with Ctrl+N and opens Settings', () => {
    const project = projectFactory.build({
      workflow_config: asWorkflowConfig(createSeededDefaultWorkflowConfig()),
    });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

    expect(screen.getByTestId('workflow-settings-state')).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('New state');
    expect(screen.getByTestId('workflow-designer-workspace')).toHaveAttribute(
      'data-dirty',
      'true'
    );
  });

  it('clears selection on Escape', () => {
    const project = projectFactory.build({ workflow_config: null });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    fireEvent.click(screen.getByTestId('select-state-new'));
    expect(screen.getByTestId('workflow-settings-state')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
  });

  it('deletes a selected edge with Delete without a confirm dialog', () => {
    const project = projectFactory.build({
      workflow_config: asWorkflowConfig(createSeededDefaultWorkflowConfig()),
    });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    fireEvent.click(screen.getByTestId('select-edge-0'));
    expect(screen.getByTestId('workflow-settings-edge')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.queryByTestId('workflow-settings-edge')).toBeNull();
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
    expect(
      screen.queryByTestId('workflow-delete-state-confirm')
    ).not.toBeInTheDocument();
  });

  it('undoes a keyboard delete with Ctrl+Z', () => {
    const project = projectFactory.build({
      workflow_config: asWorkflowConfig(createSeededDefaultWorkflowConfig()),
    });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    fireEvent.click(screen.getByTestId('select-edge-0'));
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.getByTestId('workflow-settings-empty')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    // Edge is restored; re-select to confirm Settings can show it again.
    fireEvent.click(screen.getByTestId('select-edge-0'));
    expect(screen.getByTestId('workflow-settings-edge')).toBeInTheDocument();
  });

  it('opens Workflow Help from the toolbar', () => {
    const project = projectFactory.build({ workflow_config: null });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    fireEvent.click(screen.getByTestId('workflow-designer-help-open'));
    expect(screen.getByTestId('workflow-designer-help')).toBeInTheDocument();
    expect(screen.getByText(/workflow help/i)).toBeInTheDocument();
    expect(screen.getByText(/^keyboard$/i)).toBeInTheDocument();
  });

  it('links Go to Board to the project kanban', () => {
    const project = projectFactory.build({ workflow_config: null });
    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );
    expect(screen.getByTestId('workflow-designer-go-to-board')).toHaveAttribute(
      'href',
      `/board?project=${project.id}`
    );
  });

  it('forks the active workflow via the manage API', async () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const forkId = 'wf-fork-1';
    const forked = {
      ...seeded,
      workflows: [
        ...seeded.workflows,
        {
          ...seeded.workflows[0]!,
          id: forkId,
          title: 'Default (fork)',
          forkedFromId: seeded.defaultWorkflowId,
          typeBindings: [],
        },
      ],
    };
    const project = projectFactory.build({
      workflow_config: asWorkflowConfig(seeded),
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(forkProjectWorkflow).mockResolvedValue({
      config: forked,
      forkedWorkflowId: forkId,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );

    fireEvent.click(screen.getByTestId('workflow-designer-fork'));

    await waitFor(() => {
      expect(forkProjectWorkflow).toHaveBeenCalledWith(
        project.id,
        '2026-01-01T00:00:00.000Z',
        { sourceWorkflowId: seeded.defaultWorkflowId }
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('workflow-designer-workspace')).toHaveAttribute(
        'data-workflow-id',
        forkId
      );
    });
  });

  it('marks a non-default workflow as default', async () => {
    const seeded = createSeededDefaultWorkflowConfig();
    const forkId = 'wf-fork-1';
    const withFork = {
      ...seeded,
      workflows: [
        ...seeded.workflows,
        {
          ...seeded.workflows[0]!,
          id: forkId,
          title: 'Team fork',
          forkedFromId: seeded.defaultWorkflowId,
          typeBindings: [],
        },
      ],
    };
    const asDefault = {
      ...withFork,
      defaultWorkflowId: forkId,
    };
    const project = projectFactory.build({
      workflow_config: asWorkflowConfig(withFork),
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(setDefaultProjectWorkflow).mockResolvedValue({
      config: asDefault,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    render(
      <WorkflowDesignerWorkspace
        project={project}
        canEdit
        currentUserId="user-manager-1"
      />
    );

    // Switch to the fork (Select may render as listbox; use trigger + option).
    fireEvent.click(screen.getByRole('combobox', { name: /workflow/i }));
    fireEvent.click(screen.getByRole('option', { name: /team fork/i }));

    fireEvent.click(screen.getByTestId('workflow-designer-mark-default'));

    await waitFor(() => {
      expect(setDefaultProjectWorkflow).toHaveBeenCalledWith(
        project.id,
        forkId,
        '2026-01-01T00:00:00.000Z'
      );
    });
    expect(deleteProjectWorkflow).not.toHaveBeenCalled();
  });
});
