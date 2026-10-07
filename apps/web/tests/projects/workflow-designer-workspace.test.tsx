import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import { WorkflowDesignerWorkspace } from '@/app/projects/_components/project-details/workflow-designer-workspace';
import { putProjectWorkflowConfig } from '@/app/projects/_services/projects.workflow-config.client';
import { projectFactory } from '../factories/project.factory';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('@/app/projects/_services/projects.workflow-config.client', () => ({
  putProjectWorkflowConfig: vi.fn(),
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
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
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
    expect(screen.getByText(/showing the seeded default/i)).toBeInTheDocument();
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
        '2026-01-01T00:00:00.000Z'
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
});
