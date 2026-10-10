import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';
import { ChatProposeWorkflowPatchCard } from '@/app/chat/_components/chat-propose-workflow-patch-card';
import { ChatLauncherProvider } from '@/app/chat/_components/chat-launcher';
import {
  useWorkflowProposalDismiss,
  WorkflowProposalDismissProvider,
} from '@/app/chat/_components/workflow-proposal-dismiss-context';
import { WorkflowAliceBridgeProvider } from '@/app/projects/_components/project-details/workflow-alice-bridge';

const applyWorkflowPatchMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/projects/project-1',
}));

vi.mock('@/app/chat/_services/chat.mutations.client', () => ({
  applyWorkflowPatch: (...args: unknown[]) => applyWorkflowPatchMock(...args),
}));

vi.mock('@/app/chat/_components/chat-client-bootstrap', () => ({
  bootstrapLatestChat: vi.fn(async () => ({
    conversations: [],
    activeConversationId: undefined,
    messages: [],
    chatModels: [],
  })),
}));

const PROJECT_ID = '55555555-5555-4555-8555-555555555555';

describe('ChatProposeWorkflowPatchCard', () => {
  const proposedConfig = createSeededDefaultWorkflowConfig();

  beforeEach(() => {
    applyWorkflowPatchMock.mockReset();
    applyWorkflowPatchMock.mockResolvedValue({
      config: proposedConfig,
      usedFallback: false,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('rejects without calling apply', () => {
    render(
      <ChatLauncherProvider>
        <ChatProposeWorkflowPatchCard
          action={{
            type: 'propose_workflow_patch',
            entity: {
              projectId: PROJECT_ID,
              projectName: 'Alpha',
              summary: 'Add a QA state',
              confirmationToken: 'token',
              proposedConfig,
              changeSummary: ['Added state “QA”.'],
            },
          }}
        />
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText(/Workflow proposal rejected/)).toBeTruthy();
    expect(applyWorkflowPatchMock).not.toHaveBeenCalled();
  });

  it('saves when dirty then applies and reloads the bridge', async () => {
    const saveIfDirty = vi.fn().mockResolvedValue({
      ok: true,
      expectedUpdatedAt: '2026-01-01T12:00:00.000Z',
    });
    const applyEnvelope = vi.fn();

    render(
      <ChatLauncherProvider>
        <WorkflowAliceBridgeProvider
          projectId={PROJECT_ID}
          getViewContext={() => ({
            surface: 'workflow_designer',
            projectId: PROJECT_ID,
            draftEnvelope: createSeededDefaultWorkflowConfig(),
            expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
            dirty: true,
          })}
          saveIfDirty={saveIfDirty}
          applyEnvelope={applyEnvelope}
        >
          <ChatProposeWorkflowPatchCard
            action={{
              type: 'propose_workflow_patch',
              entity: {
                projectId: PROJECT_ID,
                projectName: 'Alpha',
                summary: 'Add a QA state',
                confirmationToken: 'token',
                proposedConfig,
                changeSummary: ['Added state “QA”.'],
              },
            }}
          />
        </WorkflowAliceBridgeProvider>
      </ChatLauncherProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(saveIfDirty).toHaveBeenCalled();
      expect(applyWorkflowPatchMock).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        confirmationToken: 'token',
        proposedConfig,
        expectedUpdatedAt: '2026-01-01T12:00:00.000Z',
      });
      expect(applyEnvelope).toHaveBeenCalledWith(
        proposedConfig,
        '2026-01-02T00:00:00.000Z'
      );
    });

    expect(screen.getByText(/Workflow proposal applied/)).toBeTruthy();
  });

  it('auto-rejects when the project proposal is dismissed', () => {
    function DismissTrigger() {
      const { dismissProject } = useWorkflowProposalDismiss();
      return (
        <button type="button" onClick={() => dismissProject(PROJECT_ID)}>
          Dismiss
        </button>
      );
    }

    render(
      <WorkflowProposalDismissProvider>
        <ChatLauncherProvider>
          <ChatProposeWorkflowPatchCard
            action={{
              type: 'propose_workflow_patch',
              entity: {
                projectId: PROJECT_ID,
                projectName: 'Alpha',
                summary: 'Add a QA state',
                confirmationToken: 'token',
                proposedConfig,
                changeSummary: ['Added state “QA”.'],
              },
            }}
          />
          <DismissTrigger />
        </ChatLauncherProvider>
      </WorkflowProposalDismissProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByText(/Workflow proposal rejected/)).toBeTruthy();
    expect(applyWorkflowPatchMock).not.toHaveBeenCalled();
  });
});
