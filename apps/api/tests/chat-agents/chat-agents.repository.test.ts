import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    chat_agents: {
      findMany: findManyMock,
    },
  },
}));

import { ChatAgentsRepository } from '../../src/routes/api/chat-agents/chat-agents.repository';

describe('ChatAgentsRepository mention catalog visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
  });

  it('limits active catalog rows to workspace agents and the actor personal forks', async () => {
    const repository = new ChatAgentsRepository();

    await repository.listVisible('member-1', { status: 'active' });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ owner_id: null }, { owner_id: 'member-1' }],
          status: 'active',
        },
      })
    );
  });
});
