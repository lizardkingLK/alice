import { describe, expect, it, vi } from 'vitest';
import { createChatAgentsService } from '@/app/chat/_services/chat-agents-api.shared';

describe('createChatAgentsService', () => {
  it('lists agents from the API response', async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      agents: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          key: 'alice-default',
          ownerId: null,
          name: 'Alice',
          title: 'Assistant',
          description: 'Default',
          autonomy: 'suggest',
          status: 'active',
          version: 1,
          forkedFromId: null,
          isDefault: true,
          tagline: 'Helpful',
          avatarStyle: 'lorelei',
          avatarSeed: 'alice-v1',
          kind: 'system',
          enabledToolKeys: [],
          enabledSkillKeys: [],
          createdBy: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedBy: null,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const service = createChatAgentsService(apiFetch);
    const agents = await service.listChatAgents();
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/chat-agents');
    expect(agents).toHaveLength(1);
    expect(agents[0]?.name).toBe('Alice');
  });

  it('rejects invalid list payloads', async () => {
    const apiFetch = vi.fn().mockResolvedValue({ agents: 'nope' });
    const service = createChatAgentsService(apiFetch);
    await expect(service.listChatAgents()).rejects.toThrow(
      'Invalid chat agents response'
    );
  });
});
