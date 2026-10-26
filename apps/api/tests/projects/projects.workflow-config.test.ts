import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_ID,
  WORKFLOW_ORPHANED_STATES_CODE,
  WorkItemStatusEnum,
  createSeededDefaultWorkflowConfig,
  type WorkflowConfigEnvelope,
} from '@repo/types';

function withoutToDoState(
  envelope: WorkflowConfigEnvelope
): WorkflowConfigEnvelope {
  const workflow = envelope.workflows[0]!;
  return {
    ...envelope,
    workflows: [
      {
        ...workflow,
        graph: {
          ...workflow.graph,
          states: workflow.graph.states.filter(
            (state) => state.id !== WorkItemStatusEnum.ToDo
          ),
          edges: workflow.graph.edges.filter(
            (edge) =>
              edge.from !== WorkItemStatusEnum.ToDo &&
              edge.to !== WorkItemStatusEnum.ToDo
          ),
        },
      },
      ...envelope.workflows.slice(1),
    ],
  };
}

const {
  findByIdMock,
  updateMock,
  listAccessibleProjectIdsMock,
  selectSingleMock,
  teamsFindFirstMock,
  workItemsCountMock,
  workItemsFindManyMock,
  workItemsUpdateMock,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    findByIdMock: vi.fn(),
    updateMock: vi.fn(),
    listAccessibleProjectIdsMock: vi.fn(),
    selectSingleMock: vi.fn(),
    teamsFindFirstMock: vi.fn(),
    workItemsCountMock: vi.fn().mockResolvedValue(0),
    workItemsFindManyMock: vi.fn().mockResolvedValue([]),
    workItemsUpdateMock: vi.fn(),
  };
});

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    teams: {
      findFirst: teamsFindFirstMock,
    },
    integrations: {
      findFirst: vi.fn(),
    },
    work_items: {
      count: workItemsCountMock,
      findMany: workItemsFindManyMock,
      update: workItemsUpdateMock,
    },
  },
}));

import { ProjectsService } from '../../src/routes/api/projects/projects.service';
import type { ProjectsRepository } from '../../src/routes/api/projects/projects.repository';
import { WorkflowConfigError } from '../../src/routes/api/projects/workflow-config.errors';

const projectBase = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alice Project',
  key: 'ALICE',
  description: null,
  status: 'active' as const,
  start_date: null,
  end_date: null,
  owner_id: 'user-manager',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  jira_project_key: null,
  jira_connection_id: null,
  github_repo: null,
  github_token: null,
  logo_url: null,
  cover_picture: null,
  workflow_config: null as unknown,
};

describe('ProjectsService workflow config', () => {
  let service: ProjectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    listAccessibleProjectIdsMock.mockResolvedValue([projectBase.id]);
    findByIdMock.mockResolvedValue({ ...projectBase });
    selectSingleMock.mockResolvedValue({
      data: { role: 'manager', email: 'manager@alice.dev' },
      error: null,
    });
    teamsFindFirstMock.mockResolvedValue(null);
    workItemsCountMock.mockResolvedValue(0);
    workItemsFindManyMock.mockResolvedValue([]);

    service = new ProjectsService({
      findById: findByIdMock,
      update: updateMock,
      listAccessibleProjectIds: listAccessibleProjectIdsMock,
    } as unknown as ProjectsRepository);
  });

  it('getWorkflowConfig falls back to seeded default when config is null', async () => {
    const result = await service.getWorkflowConfig(
      projectBase.id,
      'user-manager'
    );
    expect(result.usedFallback).toBe(true);
    expect(result.config.defaultWorkflowId).toBe(DEFAULT_WORKFLOW_ID);
  });

  it('putWorkflowConfig persists a validated envelope for managers', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    updateMock.mockResolvedValue({
      ...projectBase,
      workflow_config: envelope,
      updated_at: '2026-01-02T00:00:00.000Z',
    });

    const result = await service.putWorkflowConfig(
      'user-manager',
      projectBase.id,
      envelope,
      projectBase.updated_at
    );

    expect(updateMock).toHaveBeenCalledWith(
      projectBase.id,
      expect.objectContaining({
        workflow_config: expect.objectContaining({
          schemaVersion: 1,
          defaultWorkflowId: DEFAULT_WORKFLOW_ID,
        }),
      }),
      'user-manager',
      projectBase.updated_at
    );
    expect(result.usedFallback).toBe(false);
  });

  it('putWorkflowConfig rejects removed states that still have work items', async () => {
    const previous = createSeededDefaultWorkflowConfig();
    findByIdMock.mockResolvedValue({
      ...projectBase,
      workflow_config: previous,
    });
    const next = withoutToDoState(createSeededDefaultWorkflowConfig());
    workItemsCountMock.mockResolvedValue(2);

    let caught: unknown;
    try {
      await service.putWorkflowConfig(
        'user-manager',
        projectBase.id,
        next,
        projectBase.updated_at
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(WorkflowConfigError);
    expect((caught as WorkflowConfigError).status).toBe(409);
    expect((caught as WorkflowConfigError).code).toBe(
      WORKFLOW_ORPHANED_STATES_CODE
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('putWorkflowConfig remaps orphaned items then saves', async () => {
    const previous = createSeededDefaultWorkflowConfig();
    findByIdMock.mockResolvedValue({
      ...projectBase,
      workflow_config: previous,
    });
    const next = withoutToDoState(createSeededDefaultWorkflowConfig());
    workItemsCountMock.mockResolvedValue(1);
    workItemsFindManyMock.mockResolvedValue([
      {
        id: 'wi-1',
        state: {
          workflowId: DEFAULT_WORKFLOW_ID,
          stateId: WorkItemStatusEnum.ToDo,
          category: 'todo',
        },
        status: WorkItemStatusEnum.ToDo,
        board_column_id: WorkItemStatusEnum.ToDo,
      },
    ]);
    updateMock.mockResolvedValue({
      ...projectBase,
      workflow_config: next,
      updated_at: '2026-01-05T00:00:00.000Z',
    });

    const result = await service.putWorkflowConfig(
      'user-manager',
      projectBase.id,
      next,
      projectBase.updated_at,
      [
        {
          workflowId: DEFAULT_WORKFLOW_ID,
          fromStateId: WorkItemStatusEnum.ToDo,
          toStateId: WorkItemStatusEnum.InProgress,
        },
      ]
    );

    expect(workItemsUpdateMock).toHaveBeenCalled();
    expect(result.updatedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it('forkWorkflow creates a depth-1 fork for a project team manager', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });
    teamsFindFirstMock.mockResolvedValue({ id: 'team-1' });
    const envelope = createSeededDefaultWorkflowConfig();
    findByIdMock.mockResolvedValue({
      ...projectBase,
      workflow_config: envelope,
    });
    updateMock.mockImplementation(async (_id, data) => ({
      ...projectBase,
      workflow_config: data.workflow_config,
      updated_at: '2026-01-03T00:00:00.000Z',
    }));

    const result = await service.forkWorkflow(
      'user-member',
      projectBase.id,
      { title: 'QA fork' },
      projectBase.updated_at
    );

    expect(result.forkedWorkflowId).toMatch(/^wf-/);
    expect(
      result.config.workflows.some(
        (workflow) => workflow.id === result.forkedWorkflowId
      )
    ).toBe(true);
    const fork = result.config.workflows.find(
      (workflow) => workflow.id === result.forkedWorkflowId
    );
    expect(fork?.forkedFromId).toBe(DEFAULT_WORKFLOW_ID);
    expect(fork?.title).toBe('QA fork');
  });

  it('forkWorkflow rejects members who are not team managers', async () => {
    selectSingleMock.mockResolvedValue({
      data: { role: 'member', email: 'member@alice.dev' },
      error: null,
    });
    teamsFindFirstMock.mockResolvedValue(null);

    await expect(
      service.forkWorkflow(
        'user-member',
        projectBase.id,
        {},
        projectBase.updated_at
      )
    ).rejects.toBeInstanceOf(WorkflowConfigError);
  });

  it('setDefaultWorkflow promotes a fork and moves type bindings', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    envelope.workflows[0] = {
      ...envelope.workflows[0]!,
      typeBindings: ['Story', 'Task'],
    };
    envelope.workflows.push({
      ...structuredClone(envelope.workflows[0]!),
      id: 'wf-fork',
      title: 'Fork',
      forkedFromId: DEFAULT_WORKFLOW_ID,
      typeBindings: [],
    });
    findByIdMock.mockResolvedValue({
      ...projectBase,
      workflow_config: envelope,
    });
    updateMock.mockImplementation(async (_id, data) => ({
      ...projectBase,
      workflow_config: data.workflow_config,
      updated_at: '2026-01-04T00:00:00.000Z',
    }));

    const result = await service.setDefaultWorkflow(
      'user-manager',
      projectBase.id,
      'wf-fork',
      projectBase.updated_at
    );

    expect(result.config.defaultWorkflowId).toBe('wf-fork');
    expect(
      result.config.workflows.find((workflow) => workflow.id === 'wf-fork')
        ?.typeBindings
    ).toEqual(['Story', 'Task']);
    expect(
      result.config.workflows.find(
        (workflow) => workflow.id === DEFAULT_WORKFLOW_ID
      )?.typeBindings
    ).toEqual([]);
  });

  it('deleteWorkflow blocks deleting the default workflow', async () => {
    const envelope = createSeededDefaultWorkflowConfig();
    envelope.workflows.push({
      ...structuredClone(envelope.workflows[0]!),
      id: 'wf-fork',
      title: 'Fork',
      forkedFromId: DEFAULT_WORKFLOW_ID,
      typeBindings: [],
    });
    findByIdMock.mockResolvedValue({
      ...projectBase,
      workflow_config: envelope,
    });

    await expect(
      service.deleteWorkflow(
        'user-manager',
        projectBase.id,
        DEFAULT_WORKFLOW_ID,
        projectBase.updated_at
      )
    ).rejects.toThrow(/Mark another workflow as default/);
  });

  it('importWorkflow clones from another active project and clears allowAnyOf', async () => {
    const sourceId = '22222222-2222-4222-8222-222222222222';
    const sourceEnvelope = createSeededDefaultWorkflowConfig();
    sourceEnvelope.workflows[0] = {
      ...sourceEnvelope.workflows[0]!,
      title: 'Source default',
      graph: {
        ...sourceEnvelope.workflows[0]!.graph,
        edges: sourceEnvelope.workflows[0]!.graph.edges.map((edge, index) =>
          index === 0
            ? {
                ...edge,
                allowAnyOf: [
                  { scope: 'role', role: 'manager' },
                  {
                    scope: 'user',
                    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  },
                ],
              }
            : edge
        ),
      },
    };
    const targetEnvelope = createSeededDefaultWorkflowConfig();
    listAccessibleProjectIdsMock.mockResolvedValue([projectBase.id, sourceId]);
    findByIdMock.mockImplementation(async (id: string) => {
      if (id === sourceId) {
        return {
          ...projectBase,
          id: sourceId,
          name: 'Source',
          key: 'SRC',
          workflow_config: sourceEnvelope,
        };
      }
      return {
        ...projectBase,
        workflow_config: targetEnvelope,
      };
    });
    updateMock.mockImplementation(async (_id, data) => ({
      ...projectBase,
      workflow_config: data.workflow_config,
      updated_at: '2026-01-06T00:00:00.000Z',
    }));

    const result = await service.importWorkflow(
      'user-manager',
      projectBase.id,
      {
        sourceProjectId: sourceId,
        title: 'Imported board',
      },
      projectBase.updated_at
    );

    expect(result.importedWorkflowId).toMatch(/^wf-/);
    const imported = result.config.workflows.find(
      (workflow) => workflow.id === result.importedWorkflowId
    );
    expect(imported?.title).toBe('Imported board');
    expect(imported?.forkedFromId).toBeNull();
    expect(imported?.typeBindings).toEqual([]);
    expect(
      imported?.graph.edges.every((edge) => edge.allowAnyOf.length === 0)
    ).toBe(true);
    expect(result.config.defaultWorkflowId).toBe(DEFAULT_WORKFLOW_ID);
  });

  it('importWorkflow can mark the import as default', async () => {
    const sourceId = '33333333-3333-4333-8333-333333333333';
    const sourceEnvelope = createSeededDefaultWorkflowConfig();
    const targetEnvelope = createSeededDefaultWorkflowConfig();
    targetEnvelope.workflows[0] = {
      ...targetEnvelope.workflows[0]!,
      typeBindings: ['Story'],
    };
    listAccessibleProjectIdsMock.mockResolvedValue([projectBase.id, sourceId]);
    findByIdMock.mockImplementation(async (id: string) => {
      if (id === sourceId) {
        return {
          ...projectBase,
          id: sourceId,
          workflow_config: sourceEnvelope,
        };
      }
      return {
        ...projectBase,
        workflow_config: targetEnvelope,
      };
    });
    updateMock.mockImplementation(async (_id, data) => ({
      ...projectBase,
      workflow_config: data.workflow_config,
      updated_at: '2026-01-07T00:00:00.000Z',
    }));

    const result = await service.importWorkflow(
      'user-manager',
      projectBase.id,
      {
        sourceProjectId: sourceId,
        markAsDefault: true,
      },
      projectBase.updated_at
    );

    expect(result.config.defaultWorkflowId).toBe(result.importedWorkflowId);
    expect(
      result.config.workflows.find(
        (workflow) => workflow.id === result.importedWorkflowId
      )?.typeBindings
    ).toEqual(['Story']);
  });

  it('importWorkflow rejects importing from the same project', async () => {
    await expect(
      service.importWorkflow(
        'user-manager',
        projectBase.id,
        { sourceProjectId: projectBase.id },
        projectBase.updated_at
      )
    ).rejects.toBeInstanceOf(WorkflowConfigError);
  });

  it('importWorkflow rejects a source project the actor cannot read', async () => {
    const sourceId = '44444444-4444-4444-8444-444444444444';
    listAccessibleProjectIdsMock.mockResolvedValue([projectBase.id]);

    await expect(
      service.importWorkflow(
        'user-manager',
        projectBase.id,
        { sourceProjectId: sourceId },
        projectBase.updated_at
      )
    ).rejects.toBeInstanceOf(WorkflowConfigError);
  });
});
