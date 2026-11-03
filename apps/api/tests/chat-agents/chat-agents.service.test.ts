import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatAgentsService } from '../../src/routes/api/chat-agents/chat-agents.service';
import type { ChatAgentsRepository } from '../../src/routes/api/chat-agents/chat-agents.repository';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString(
    'base64'
  );
});

const {
  listVisibleMock,
  findVisibleByIdMock,
  findByIdMock,
  countActiveAgentsMock,
  findExistingForkMock,
  listEnablementForAgentsMock,
  listActiveToolsMock,
  listActiveSkillsMock,
  findToolIdsByKeysMock,
  findSkillIdsByKeysMock,
  listEnabledToolIdsMock,
  listEnabledSkillIdsMock,
  createForkMock,
  patchAgentMock,
  deleteAgentMock,
  setDefaultMock,
  findOldestActiveAgentMock,
  encryptSecretMock,
  decryptSecretMock,
  requireUserWithRoleMock,
} = vi.hoisted(() => ({
  listVisibleMock: vi.fn(),
  findVisibleByIdMock: vi.fn(),
  findByIdMock: vi.fn(),
  countActiveAgentsMock: vi.fn(),
  findExistingForkMock: vi.fn(),
  listEnablementForAgentsMock: vi.fn(),
  listActiveToolsMock: vi.fn(),
  listActiveSkillsMock: vi.fn(),
  findToolIdsByKeysMock: vi.fn(),
  findSkillIdsByKeysMock: vi.fn(),
  listEnabledToolIdsMock: vi.fn(),
  listEnabledSkillIdsMock: vi.fn(),
  createForkMock: vi.fn(),
  patchAgentMock: vi.fn(),
  deleteAgentMock: vi.fn(),
  setDefaultMock: vi.fn(),
  findOldestActiveAgentMock: vi.fn(),
  encryptSecretMock: vi.fn((value: string) => `v1:${value}`),
  decryptSecretMock: vi.fn((value: string) =>
    value.startsWith('v1:') ? value.slice(3) : value
  ),
  requireUserWithRoleMock: vi.fn(),
}));

vi.mock('../../src/lib/secrets/token-crypto', () => ({
  encryptSecret: encryptSecretMock,
  decryptSecret: decryptSecretMock,
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

const repository = {
  listVisible: listVisibleMock,
  findVisibleById: findVisibleByIdMock,
  findById: findByIdMock,
  countActiveAgents: countActiveAgentsMock,
  findExistingFork: findExistingForkMock,
  listEnablementForAgents: listEnablementForAgentsMock,
  listActiveTools: listActiveToolsMock,
  listActiveSkills: listActiveSkillsMock,
  findToolIdsByKeys: findToolIdsByKeysMock,
  findSkillIdsByKeys: findSkillIdsByKeysMock,
  listEnabledToolIds: listEnabledToolIdsMock,
  listEnabledSkillIds: listEnabledSkillIdsMock,
  createFork: createForkMock,
  patchAgent: patchAgentMock,
  deleteAgent: deleteAgentMock,
  setDefault: setDefaultMock,
  findOldestActiveAgent: findOldestActiveAgentMock,
} as unknown as ChatAgentsRepository;

const aliceRow = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'alice-default',
  owner_id: null,
  name: 'Alice',
  title: 'Assistant',
  description: 'Default',
  instructions: 'v1:You are Alice',
  autonomy: 'suggest' as const,
  status: 'active' as const,
  version: 1,
  forked_from_id: null,
  is_default: true,
  tagline: 'Help',
  avatar_style: 'lorelei',
  avatar_seed: 'alice-default-v1',
  created_by: 'admin-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_by: 'admin-1',
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ChatAgentsService', () => {
  const service = new ChatAgentsService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserWithRoleMock.mockResolvedValue({
      id: 'member-1',
      role: 'member',
      email: 'member@alice.dev',
    });
    listEnablementForAgentsMock.mockResolvedValue(
      new Map([
        [
          aliceRow.id,
          {
            enabledToolKeys: ['list_projects'],
            enabledSkillKeys: ['project_briefs'],
          },
        ],
      ])
    );
  });

  it('lists visible agents without instructions', async () => {
    // Arrange
    listVisibleMock.mockResolvedValue([aliceRow]);

    // Act
    const agents = await service.listAgents('member-1', {});

    // Assert
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: aliceRow.id,
      kind: 'system',
      isDefault: true,
      enabledToolKeys: ['list_projects'],
    });
    expect(agents[0]).not.toHaveProperty('instructions');
  });

  it('decrypts instructions on getAgent', async () => {
    // Arrange
    findVisibleByIdMock.mockResolvedValue(aliceRow);

    // Act
    const agent = await service.getAgent('member-1', aliceRow.id);

    // Assert
    expect(decryptSecretMock).toHaveBeenCalledWith(aliceRow.instructions);
    expect(agent.instructions).toBe('You are Alice');
  });

  it('rejects a second fork of the same workspace agent', async () => {
    // Arrange
    findVisibleByIdMock.mockResolvedValue(aliceRow);
    findExistingForkMock.mockResolvedValue({
      ...aliceRow,
      id: '22222222-2222-4222-8222-222222222222',
      owner_id: 'member-1',
      key: null,
      is_default: false,
    });

    // Act / Assert
    await expect(service.forkAgent('member-1', aliceRow.id)).rejects.toThrow(
      /already forked/i
    );
    expect(createForkMock).not.toHaveBeenCalled();
  });

  it('forks a workspace agent once and re-encrypts instructions', async () => {
    // Arrange
    findVisibleByIdMock.mockResolvedValue(aliceRow);
    findExistingForkMock.mockResolvedValue(null);
    listEnabledToolIdsMock.mockResolvedValue(['tool-1']);
    listEnabledSkillIdsMock.mockResolvedValue(['skill-1']);
    const forkRow = {
      ...aliceRow,
      id: '22222222-2222-4222-8222-222222222222',
      key: null,
      owner_id: 'member-1',
      is_default: false,
      version: 2,
      forked_from_id: aliceRow.id,
      instructions: 'v1:You are Alice',
    };
    createForkMock.mockResolvedValue(forkRow);
    listEnablementForAgentsMock.mockResolvedValue(
      new Map([
        [
          forkRow.id,
          { enabledToolKeys: ['list_projects'], enabledSkillKeys: [] },
        ],
      ])
    );

    // Act
    const agent = await service.forkAgent('member-1', aliceRow.id);

    // Assert
    expect(createForkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'member-1',
        instructionsCiphertext: 'v1:You are Alice',
        enabledToolIds: ['tool-1'],
        enabledSkillIds: ['skill-1'],
      })
    );
    expect(agent.kind).toBe('personal');
    expect(agent.version).toBe(2);
  });

  it('rejects deleting the last active agent', async () => {
    // Arrange
    findVisibleByIdMock.mockResolvedValue(aliceRow);
    requireUserWithRoleMock.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      email: 'admin@alice.dev',
    });
    countActiveAgentsMock.mockResolvedValue(1);

    // Act / Assert
    await expect(service.deleteAgent('admin-1', aliceRow.id)).rejects.toThrow(
      /last active/i
    );
    expect(deleteAgentMock).not.toHaveBeenCalled();
  });

  it('promotes another active agent when deleting the default', async () => {
    // Arrange
    findVisibleByIdMock.mockResolvedValue(aliceRow);
    requireUserWithRoleMock.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      email: 'admin@alice.dev',
    });
    countActiveAgentsMock.mockResolvedValue(2);
    const other = {
      ...aliceRow,
      id: '33333333-3333-4333-8333-333333333333',
      key: null,
      is_default: false,
    };
    findOldestActiveAgentMock.mockResolvedValue(other);
    setDefaultMock.mockResolvedValue(other);

    // Act
    await service.deleteAgent('admin-1', aliceRow.id);

    // Assert
    expect(deleteAgentMock).toHaveBeenCalledWith(aliceRow.id);
    expect(setDefaultMock).toHaveBeenCalledWith('admin-1', other.id);
  });

  it('setDefault is admin-only for workspace agents', async () => {
    // Arrange
    requireUserWithRoleMock.mockRejectedValueOnce(
      new Error(
        'Unauthorized. Only administrators can manage workspace chat agents.'
      )
    );

    // Act / Assert
    await expect(service.setDefault('member-1', aliceRow.id)).rejects.toThrow(
      /Unauthorized/i
    );
  });
});
