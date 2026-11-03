import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHART_DESCRIPTION_TOOL_KEY,
  DYNAMIC_FIELDS_TOOL_KEY,
  buildFallbackChatAgentRuntime,
  resolveChatAgentRuntime,
  resolveSpecializedSystemInstruction,
} from '../../src/routes/api/chat/chat-agent-runtime';
import { systemInstruction } from '../../src/routes/api/chat/chat.route.data';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString(
    'base64'
  );
});

const {
  findVisibleByIdMock,
  findActiveDefaultMock,
  listEnablementForAgentsMock,
  listActiveToolsMock,
  decryptSecretMock,
} = vi.hoisted(() => ({
  findVisibleByIdMock: vi.fn(),
  findActiveDefaultMock: vi.fn(),
  listEnablementForAgentsMock: vi.fn(),
  listActiveToolsMock: vi.fn(),
  decryptSecretMock: vi.fn((value: string) =>
    value.startsWith('v1:') ? value.slice(3) : value
  ),
}));

vi.mock('../../src/lib/secrets/token-crypto', () => ({
  decryptSecret: decryptSecretMock,
}));

describe('chat-agent-runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to hardcoded prompts when no chatAgents repository is provided', async () => {
    // Arrange / Act
    const runtime = await resolveChatAgentRuntime({ userId: 'user-1' });

    // Assert
    expect(runtime.instructions).toBe(systemInstruction);
    expect(runtime.enabledToolNames).toBeNull();
    expect(runtime.tools.length).toBeGreaterThan(0);
  });

  it('filters tools to the agent enablement set and decrypts instructions', async () => {
    // Arrange
    findActiveDefaultMock.mockResolvedValue({
      id: 'agent-1',
      instructions: 'v1:Custom Alice instructions',
    });
    listEnablementForAgentsMock.mockResolvedValue(
      new Map([
        [
          'agent-1',
          {
            enabledToolKeys: ['list_projects', 'create_project'],
            enabledSkillKeys: [],
          },
        ],
      ])
    );
    listActiveToolsMock.mockResolvedValue([
      {
        key: CHART_DESCRIPTION_TOOL_KEY,
        instruction: 'v1:Chart tool instruction',
      },
    ]);

    // Act
    const runtime = await resolveChatAgentRuntime({
      userId: 'user-1',
      chatAgents: {
        findVisibleById: findVisibleByIdMock,
        findActiveDefault: findActiveDefaultMock,
        listEnablementForAgents: listEnablementForAgentsMock,
        listActiveTools: listActiveToolsMock,
      },
    });

    // Assert
    expect(runtime.instructions).toBe('Custom Alice instructions');
    expect([...runtime.enabledToolNames!]).toEqual([
      'list_projects',
      'create_project',
    ]);
    expect(runtime.tools.map((tool) => tool.name)).toEqual([
      'list_projects',
      'create_project',
    ]);
    expect(runtime.toolInstructions.get(CHART_DESCRIPTION_TOOL_KEY)).toBe(
      'Chart tool instruction'
    );
  });

  it('resolveSpecializedSystemInstruction prefers tool-level text', () => {
    // Arrange
    const runtime = buildFallbackChatAgentRuntime();

    // Act / Assert
    expect(
      resolveSpecializedSystemInstruction(runtime, DYNAMIC_FIELDS_TOOL_KEY)
    ).toMatch(/dynamic fields/i);
  });
});
