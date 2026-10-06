import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_ID,
  createSeededDefaultWorkflowConfig,
} from '@repo/types';

const {
  findByIdMock,
  updateMock,
  listAccessibleProjectIdsMock,
  selectSingleMock,
  teamsFindFirstMock,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    findByIdMock: vi.fn(),
    updateMock: vi.fn(),
    listAccessibleProjectIdsMock: vi.fn(),
    selectSingleMock: vi.fn(),
    teamsFindFirstMock: vi.fn(),
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

  it('setDefaultWorkflow promotes a fork', async () => {
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
});
