import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardConfig } from '@repo/types/api/v1';

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

const TEAM_ID = '764e1be5-67b4-43dc-a30c-0f66a07ba780';
const USER_ID = '1559d73c-a39f-452d-a275-e981dedff035';
const GENERATED_ID = '11111111-1111-4111-8111-111111111111';

const columns = [
  { id: 'new', name: 'New', status: 'New' as const },
  { id: 'todo', name: 'To Do', status: 'ToDo' as const },
  { id: 'development', name: 'Development', status: 'InProgress' as const },
  { id: 'review', name: 'Code Review', status: 'InProgress' as const },
  { id: 'testing', name: 'Testing', status: 'Testing' as const },
  { id: 'done', name: 'Done', status: 'Done' as const },
];

type DraftColumnInput = {
  existingColumnId?: string;
  temporaryKey?: string;
  name: string;
  status: (typeof columns)[number]['status'];
};

function columnInput(source = columns): DraftColumnInput[] {
  return source.map((column) => ({
    existingColumnId: column.id,
    name: column.name,
    status: column.status,
  }));
}

function configuredBoard(actions: ToolAction[]): BoardConfig {
  const action = actions.find(
    (candidate) => candidate.type === 'configure_board'
  );
  if (!action || action.type !== 'configure_board') {
    throw new Error('Expected configure_board action');
  }
  return action.entity.config;
}

function projectWith(workflowConfig: unknown) {
  return {
    id: 'project-1',
    name: 'Alpha Project',
    key: 'ALPHA',
    description: 'Alpha project',
    status: 'active',
    workflow_config: workflowConfig,
  };
}

function createHarness(workflowConfig: unknown = { version: '1', columns }) {
  const getProjectDetail = vi
    .fn()
    .mockResolvedValue(projectWith(workflowConfig));
  const listActiveByProject = vi
    .fn()
    .mockResolvedValue([{ id: TEAM_ID, name: 'QA Team' }]);
  const listActiveBoardMembers = vi.fn().mockResolvedValue([
    {
      id: USER_ID,
      name: 'John Reviewer',
      email: 'john@example.com',
      role: 'member',
    },
  ]);

  const service = new ChatService({
    chat: {} as never,
    chatAttachments: {} as never,
    deduplicationAgent: {} as never,
    workItemService: { createWorkItem: vi.fn() } as never,
    sprintsService: { createSprint: vi.fn() } as never,
    projectsService: {
      createProject: vi.fn(),
      getProjectDetail,
    } as never,
    projectsRepository: {
      listAll: vi.fn(),
      findById: vi.fn(),
      listActiveBoardMembers,
    } as never,
    teamsRepository: { listActiveByProject } as never,
    integrationsService: { resolveChatModelForChat: vi.fn() } as never,
  });

  return {
    service,
    getProjectDetail,
    listActiveByProject,
    listActiveBoardMembers,
  };
}

async function callTool(
  service: ChatService,
  name: string,
  args: Record<string, unknown>
) {
  const actions: ToolAction[] = [];
  const parts = await service.processFunctionCalls(
    'actor-1',
    [{ functionCall: { name, args } }] satisfies ChatContentPart[],
    actions
  );
  return {
    actions,
    result: parts[0]?.functionResponse?.response.result as Record<
      string,
      unknown
    >,
  };
}

describe('Alice board tools', () => {
  beforeEach(() => {
    requireUserWithRoleMock.mockResolvedValue({ role: 'manager' });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(GENERATED_ID);
  });

  it('lists only the project-scoped entities after checking access', async () => {
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'list_board_entities',
      { projectId: 'project-1' }
    );

    expect(harness.getProjectDetail).toHaveBeenCalledWith(
      'project-1',
      'actor-1'
    );
    expect(harness.listActiveByProject).toHaveBeenCalledWith('project-1');
    expect(harness.listActiveBoardMembers).toHaveBeenCalledWith('project-1');
    expect(result).toMatchObject({
      project: { id: 'project-1', name: 'Alpha Project', key: 'ALPHA' },
      boardConfig: { version: '1', columns },
      teams: [{ id: TEAM_ID, name: 'QA Team' }],
      members: [{ id: USER_ID, name: 'John Reviewer' }],
    });
    expect(actions).toEqual([]);
  });

  it('rejects an inaccessible project before returning entities', async () => {
    const harness = createHarness();
    harness.getProjectDetail.mockRejectedValue(
      new Error('Unauthorized project workspace access.')
    );

    const { result, actions } = await callTool(
      harness.service,
      'list_board_entities',
      { projectId: 'project-2' }
    );

    expect(result.error).toBe('Unauthorized project workspace access.');
    expect(harness.listActiveByProject).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it.each(['manager', 'admin'])(
    '%s may create a structured v1 draft',
    async (role) => {
      requireUserWithRoleMock.mockResolvedValue({ role });
      const harness = createHarness();
      const { result, actions } = await callTool(
        harness.service,
        'configure_board_draft',
        { projectId: 'project-1', columns: columnInput() }
      );

      expect(result).toMatchObject({ draftCreated: true, saved: false });
      expect(actions).toEqual([
        {
          type: 'configure_board',
          entity: {
            projectId: 'project-1',
            projectName: 'Alpha Project',
            config: { version: '1', columns },
          },
        },
      ]);
    }
  );

  it('blocks members from receiving a structured draft action', async () => {
    requireUserWithRoleMock.mockRejectedValue(
      new Error('Only admins and managers can create a structured board draft.')
    );
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'configure_board_draft',
      { projectId: 'project-1', columns: columnInput() }
    );

    expect(result.error).toMatch(/Only admins and managers/);
    expect(actions).toEqual([]);
  });

  it('creates a valid v2 draft using real project team and member IDs', async () => {
    const harness = createHarness();
    const { actions } = await callTool(
      harness.service,
      'configure_board_draft',
      {
        projectId: 'project-1',
        columns: columnInput(),
        transitions: [
          {
            fromColumnRef: 'development',
            toColumnRef: 'review',
            allowAnyOf: [
              { scope: 'role', role: 'manager' },
              { scope: 'team', teamId: TEAM_ID },
              { scope: 'user', userId: USER_ID },
            ],
          },
        ],
      }
    );

    expect(configuredBoard(actions)).toMatchObject({
      version: '2',
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'review',
        },
      ],
    });
  });

  it('rejects invalid configs without emitting an action', async () => {
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'configure_board_draft',
      {
        projectId: 'project-1',
        columns: columnInput().filter(
          (column) => column.existingColumnId !== 'done'
        ),
      }
    );

    expect(result.error).toMatch(/at least one column mapped to Done/);
    expect(actions).toEqual([]);
  });

  it('renames an existing column while preserving its stable ID', async () => {
    const existing: BoardConfig = {
      version: '2',
      columns,
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'review',
          allowAnyOf: [{ scope: 'role', role: 'manager' }],
        },
      ],
    };
    const harness = createHarness(existing);
    const input = columnInput();
    const review = input.find((column) => column.existingColumnId === 'review');
    if (review) review.name = 'Peer Review';

    const { actions } = await callTool(
      harness.service,
      'configure_board_draft',
      { projectId: 'project-1', columns: input }
    );
    const config = configuredBoard(actions);
    expect(config).toEqual({
      ...existing,
      columns: columns.map((column) =>
        column.id === 'review' ? { ...column, name: 'Peer Review' } : column
      ),
    });
  });

  it('keeps IDs stable when an existing column status changes or columns reorder', async () => {
    const harness = createHarness();
    const input = columnInput();
    const review = input.splice(3, 1)[0]!;
    review.status = 'Testing';
    input.splice(2, 0, review);

    const { actions } = await callTool(
      harness.service,
      'configure_board_draft',
      { projectId: 'project-1', columns: input }
    );
    const config = configuredBoard(actions);

    expect(config.columns.map((column) => column.id)).toEqual([
      'new',
      'todo',
      'review',
      'development',
      'testing',
      'done',
    ]);
    expect(config.columns[2]).toEqual({
      id: 'review',
      name: 'Code Review',
      status: 'Testing',
    });
  });

  it('assigns an application UUID and resolves a new temporary transition reference', async () => {
    const harness = createHarness();
    const input = columnInput();
    input.splice(4, 0, {
      temporaryKey: 'qa-review',
      name: 'QA Review',
      status: 'InProgress',
    });

    const { actions } = await callTool(
      harness.service,
      'configure_board_draft',
      {
        projectId: 'project-1',
        columns: input,
        transitions: [
          {
            fromColumnRef: 'development',
            toColumnRef: 'qa-review',
            allowAnyOf: [{ scope: 'role', role: 'manager' }],
          },
        ],
      }
    );
    const config = configuredBoard(actions);
    expect(config.columns[4]).toEqual({
      id: GENERATED_ID,
      name: 'QA Review',
      status: 'InProgress',
    });
    expect(config.columns.map((column) => column.id)).toEqual([
      'new',
      'todo',
      'development',
      'review',
      GENERATED_ID,
      'testing',
      'done',
    ]);
    expect(config).toMatchObject({
      version: '2',
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: GENERATED_ID,
        },
      ],
    });
    expect(JSON.stringify(config)).not.toContain('qa-review');
  });

  it('rejects guessed team IDs that are not active in the project', async () => {
    const harness = createHarness();
    const { result, actions } = await callTool(
      harness.service,
      'configure_board_draft',
      {
        projectId: 'project-1',
        columns: columnInput(),
        transitions: [
          {
            fromColumnRef: 'development',
            toColumnRef: 'review',
            allowAnyOf: [
              {
                scope: 'team',
                teamId: '13b6bc61-8e3f-4a9b-9667-4b65f432e70b',
              },
            ],
          },
        ],
      }
    );

    expect(result.error).toMatch(/not an active team in this project/);
    expect(actions).toEqual([]);
  });

  it('rejects a supplied existing ID that is not in the current board', async () => {
    const harness = createHarness();
    const input = columnInput();
    input[0]!.existingColumnId = 'invented-id';

    const { result, actions } = await callTool(
      harness.service,
      'configure_board_draft',
      { projectId: 'project-1', columns: input }
    );
    expect(result.error).toMatch(/not part of the current board/);
    expect(actions).toEqual([]);
  });

  it('preserves unrelated existing v2 transitions when transitions are omitted', async () => {
    const existing: BoardConfig = {
      version: '2',
      columns,
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'review',
          allowAnyOf: [{ scope: 'role', role: 'manager' }],
        },
      ],
    };
    const harness = createHarness(existing);
    const input = columnInput();
    input[0]!.name = 'Incoming';

    const { actions } = await callTool(
      harness.service,
      'configure_board_draft',
      { projectId: 'project-1', columns: input }
    );
    expect(configuredBoard(actions)).toEqual({
      ...existing,
      columns: [{ ...columns[0], name: 'Incoming' }, ...columns.slice(1)],
    });
  });

  it('returns duplicate entity names for clarification without creating a draft', async () => {
    const harness = createHarness();
    harness.listActiveByProject.mockResolvedValue([
      { id: TEAM_ID, name: 'QA Team' },
      {
        id: '13b6bc61-8e3f-4a9b-9667-4b65f432e70b',
        name: 'QA Team',
      },
    ]);

    const { result, actions } = await callTool(
      harness.service,
      'list_board_entities',
      { projectId: 'project-1' }
    );
    expect(result.teams).toHaveLength(2);
    expect(actions).toEqual([]);
  });
});
