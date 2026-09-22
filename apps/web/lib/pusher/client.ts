'use client';

import Pusher, { type ChannelAuthorizationHandler } from 'pusher-js';
import { apiFetch } from '@/lib/api/api-fetch.use.client';

let pusherClient: Pusher | null = null;

type ChannelAuthorizationData = {
  auth: string;
  channel_data?: string;
  shared_secret?: string;
};

const authorizeChannel: ChannelAuthorizationHandler = (params, callback) => {
  apiFetch<ChannelAuthorizationData>('/api/pusher/auth', {
    method: 'POST',
    body: JSON.stringify({
      socket_id: params.socketId,
      channel_name: params.channelName,
    }),
  })
    .then((authorization) => callback(null, authorization))
    .catch(() =>
      callback(new Error('Realtime channel authorization failed.'), null)
    );
};

export function getPusherClient(): Pusher {
  if (!pusherClient) {
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      channelAuthorization: {
        customHandler: authorizeChannel,
      },
    });
  }

  return pusherClient;
}

export function disconnectPusherClient(
  client: Pusher | null = pusherClient
): void {
  if (!client) {
    return;
  }

  client.disconnect();
  if (pusherClient === client) {
    pusherClient = null;
  }
}
