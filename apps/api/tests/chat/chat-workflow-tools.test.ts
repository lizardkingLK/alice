import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSeededDefaultWorkflowConfig,
  type WorkflowConfigEnvelope,
} from '@repo/types/api/v1';

const { requireUserWithRoleMock } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return { requireUserWithRoleMock: vi.fn() };
});

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {},
}));

import { ChatService } from '../../src/routes/api/chat/chat.service';
import type {
  ChatContentPart,
  ToolAction,
} from '../../src/routes/api/chat/chat.route.types';
import { verifyWorkflowPatchToken } from '../../src/routes/api/chat/workflow-patch-token';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = '44444444-4444-4444-8444-444444444444';

function projectRow() {
  return {
    id: PROJECT_ID,
    name: 'Alpha Project',
    key: 'ALPHA',
    description: 'Alpha',
    status: 'active',
    workflow_config: createSeededDefaultWorkflowConfig(),
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function createHarness(
  config: WorkflowConfigEnvelope = createSeededDefaultWorkflowConfig()
) {
  const getProjectDetail = vi.fn().mockResolvedValue(projectRow());
  const getWorkflowConfig = vi.fn().mockResolvedValue({
    config,
    usedFallback: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const putWorkflowConfig = vi.fn().mockResolvedValue({
    config,
    usedFallback: false,
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  const service = new ChatService({
    chat: {} as never,
    chatAttachments: {} as never,
    deduplicationAgent: {} as never,
    workItemService: { createWorkItem: vi.fn() } as never,
    sprintsService: { createSprint: vi.fn() } as never,
    projectsService: {
      createProject: vi.fn(),
      getProjectDetail,
      listProjectsForActor: vi.fn(),
      getWorkflowConfig,
      putWorkflowConfig,
    } as never,
    projectsRepository: {
      listAll: vi.fn(),
      findById: vi.fn(),
      listActiveBoardMembers: vi.fn(),
    } as never,
    teamsRepository: { listActiveByProject: vi.fn() } as never,
    integrationsService: { resolveChatModelForChat: vi.fn() } as never,
  });

  return { service, getWorkflowConfig, putWorkflowConfig, getProjectDetail };
}

async function callTool(
  service: ChatService,
  name: string,
  args: Record<string, unknown>,
  viewContext?: Parameters<ChatService['processFunctionCalls']>[4]
) {
  const actions: ToolAction[] = [];
  const parts = await service.processFunctionCalls(
    ACTOR_ID,
    [{ functionCall: { name, args } }] satisfies ChatContentPart[],
    actions,
    [],
    viewContext
  );
  return {
    actions,
    result: parts[0]?.functionResponse?.response.result as Record<
      string,
      unknown
    >,
  };
}

describe('Alice workflow tools', () => {
  beforeEach(() => {
    requireUserWithRoleMock.mockResolvedValue({ role: 'manager' });
  });

  it('returns server workflow config from get_workflow_config', async () => {
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'get_workflow_config',
      { projectId: PROJECT_ID }
    );

    expect(harness.getWorkflowConfig).toHaveBeenCalledWith(
      PROJECT_ID,
      ACTOR_ID
    );
    expect(result.source).toBe('server');
    expect(result.config).toMatchObject({ schemaVersion: 1 });
    expect(actions).toEqual([]);
  });

  it('prefers designer draft when view context is present', async () => {
    const harness = createHarness();
    const draft = createSeededDefaultWorkflowConfig();
    draft.workflows[0]!.title = 'Designer Draft';

    const { result } = await callTool(
      harness.service,
      'get_workflow_config',
      { projectId: PROJECT_ID },
      {
        surface: 'workflow_designer',
        projectId: PROJECT_ID,
        draftEnvelope: draft,
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        dirty: true,
      }
    );

    expect(result.source).toBe('designer_draft');
    expect((result.config as WorkflowConfigEnvelope).workflows[0]?.title).toBe(
      'Designer Draft'
    );
    expect(result.dirty).toBe(true);
  });

  it('emits propose_workflow_patch action with confirmation token', async () => {
    const harness = createHarness();
    const next = createSeededDefaultWorkflowConfig();
    next.workflows[0]!.title = 'Updated Default';

    const { result, actions } = await callTool(
      harness.service,
      'propose_workflow_patch',
      {
        projectId: PROJECT_ID,
        summary: 'Rename default workflow',
        config: next,
      }
    );

    expect(result.proposed).toBe(true);
    expect(result.saved).toBe(false);
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action?.type).toBe('propose_workflow_patch');
    if (action?.type !== 'propose_workflow_patch') {
      throw new Error('expected propose_workflow_patch');
    }
    expect(action.entity.summary).toBe('Rename default workflow');
    expect(
      verifyWorkflowPatchToken(action.entity.confirmationToken, {
        userId: ACTOR_ID,
        projectId: PROJECT_ID,
        config: next,
      }).projectId
    ).toBe(PROJECT_ID);
  });

  it('rejects propose for non-managers', async () => {
    requireUserWithRoleMock.mockRejectedValue(
      new Error(
        'Only admins and managers can propose workflow changes. You can still ask Alice for conversational suggestions.'
      )
    );
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'propose_workflow_patch',
      {
        projectId: PROJECT_ID,
        summary: 'Nope',
        config: createSeededDefaultWorkflowConfig(),
      }
    );
    expect(result.error).toMatch(/Only admins and managers/);
    expect(actions).toEqual([]);
  });

  it('emits dismiss_workflow_patch without mutating the canvas', async () => {
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'dismiss_workflow_proposal',
      {
        projectId: PROJECT_ID,
        reason: 'Testing state already exists',
      }
    );

    expect(result.dismissed).toBe(true);
    expect(result.saved).toBe(false);
    expect(harness.putWorkflowConfig).not.toHaveBeenCalled();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: 'dismiss_workflow_patch',
      entity: {
        projectId: PROJECT_ID,
        projectName: 'Alpha Project',
        reason: 'Testing state already exists',
      },
    });
  });

  it('applies a verified workflow patch via putWorkflowConfig', async () => {
    const harness = createHarness();
    const next = createSeededDefaultWorkflowConfig();
    next.workflows[0]!.title = 'Applied';

    const { actions } = await callTool(
      harness.service,
      'propose_workflow_patch',
      {
        projectId: PROJECT_ID,
        summary: 'Apply me',
        config: next,
      }
    );
    const action = actions[0];
    if (action?.type !== 'propose_workflow_patch') {
      throw new Error('expected propose_workflow_patch');
    }

    const applied = await harness.service.applyWorkflowPatch(ACTOR_ID, {
      projectId: PROJECT_ID,
      confirmationToken: action.entity.confirmationToken,
      proposedConfig: next,
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(harness.putWorkflowConfig).toHaveBeenCalledWith(
      ACTOR_ID,
      PROJECT_ID,
      next,
      '2026-01-01T00:00:00.000Z'
    );
    expect(applied.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });
});
