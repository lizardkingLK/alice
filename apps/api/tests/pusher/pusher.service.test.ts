import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Pusher from 'pusher';
import type { UsersRepository } from '../../src/routes/api/users/users.repository';
import { PusherService } from '../../src/routes/api/pusher/pusher.service';

const findByIdMock = vi.fn();
const authorizeChannelMock = vi.fn();

const usersRepository = {
  findById: findByIdMock,
} as unknown as Pick<UsersRepository, 'findById'>;

const pusherClient = {
  authorizeChannel: authorizeChannelMock,
} as unknown as Pick<Pusher, 'authorizeChannel'>;

const service = new PusherService(usersRepository, pusherClient);

const activeUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alice User',
  email: 'alice@example.com',
  role: 'member' as const,
  active: true,
  membership_status: 'active' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('PusherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authorizes the workspace presence channel with the authenticated user ID', async () => {
    const authorization = {
      auth: 'mock-key:signature',
      channel_data: JSON.stringify({ user_id: activeUser.id }),
    };
    findByIdMock.mockResolvedValue(activeUser);
    authorizeChannelMock.mockReturnValue(authorization);

    await expect(
      service.authorizePresenceChannel(
        activeUser.id,
        '123.456',
        'presence-workspace'
      )
    ).resolves.toEqual(authorization);

    expect(findByIdMock).toHaveBeenCalledWith(activeUser.id);
    expect(authorizeChannelMock).toHaveBeenCalledWith(
      '123.456',
      'presence-workspace',
      { user_id: activeUser.id }
    );
  });

  it.each(['presence-another-workspace', 'private-test', 'presence-user-123'])(
    'rejects the unauthorized channel %s before loading the user',
    async (channel) => {
      await expect(
        service.authorizePresenceChannel(activeUser.id, '123.456', channel)
      ).rejects.toMatchObject({
        message: 'Forbidden',
        status: 403,
      });

      expect(findByIdMock).not.toHaveBeenCalled();
      expect(authorizeChannelMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['inactive', { ...activeUser, active: false }],
    ['pending', { ...activeUser, membership_status: 'pending' as const }],
    ['missing', null],
  ])('rejects an %s Alice user', async (_label, user) => {
    findByIdMock.mockResolvedValue(user);

    await expect(
      service.authorizePresenceChannel(
        activeUser.id,
        '123.456',
        'presence-workspace'
      )
    ).rejects.toMatchObject({
      message: 'Forbidden',
      status: 403,
    });

    expect(authorizeChannelMock).not.toHaveBeenCalled();
  });
});
