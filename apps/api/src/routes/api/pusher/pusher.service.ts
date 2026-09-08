import { isProductUsableUser } from '@repo/types';
import type Pusher from 'pusher';
import type { UsersRepository } from '../users/users.repository';

const PRESENCE_CHANNEL = 'presence-workspace';

export class PusherServiceError extends Error {
  constructor(
    message: string,
    readonly status: 403
  ) {
    super(message);
    this.name = 'PusherServiceError';
  }
}

export function isPusherServiceError(
  error: unknown
): error is PusherServiceError {
  return error instanceof PusherServiceError;
}

export class PusherService {
  constructor(
    private readonly usersRepository: Pick<UsersRepository, 'findById'>,
    private readonly pusherClient: Pick<Pusher, 'authorizeChannel'>
  ) {}

  async authorizePresenceChannel(
    userId: string,
    socketId: string,
    channelName: string
  ): Promise<Pusher.ChannelAuthResponse> {
    if (channelName !== PRESENCE_CHANNEL) {
      throw new PusherServiceError('Forbidden', 403);
    }

    const user = await this.usersRepository.findById(userId);
    if (!user || !isProductUsableUser(user)) {
      throw new PusherServiceError('Forbidden', 403);
    }

    return this.pusherClient.authorizeChannel(socketId, channelName, {
      user_id: userId,
    });
  }
}
