'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Members, PresenceChannel } from 'pusher-js';
import { disconnectPusherClient, getPusherClient } from '@/lib/pusher/client';

const PRESENCE_CHANNEL = 'presence-workspace';
const STALE_CONNECTION_STATES = new Set([
  'unavailable',
  'failed',
  'disconnected',
]);

type PresenceMember = {
  id?: unknown;
};

type ConnectionStateChange = {
  current?: unknown;
};

/* eslint-disable no-unused-vars -- callback type params */
type RealtimeContextValue = {
  readonly isUserOnline: (userId: string) => boolean;
};
/* eslint-enable no-unused-vars */

type PresenceState = {
  readonly authenticatedUserId: string;
  readonly onlineUserIds: ReadonlySet<string>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function memberId(member: unknown): string | null {
  if (!member || typeof member !== 'object') {
    return null;
  }

  const id = (member as PresenceMember).id;
  return typeof id === 'string' ? id : null;
}

function memberIds(members: Members): ReadonlySet<string> {
  const ids = new Set<string>();
  members.each((member: unknown) => {
    const id = memberId(member);
    if (id) {
      ids.add(id);
    }
  });
  return ids;
}

export function RealtimeProvider({
  authenticatedUserId,
  children,
}: Readonly<{
  authenticatedUserId: string | null;
  children: ReactNode;
}>) {
  const [presence, setPresence] = useState<PresenceState | null>(null);

  useEffect(() => {
    if (!authenticatedUserId) {
      return;
    }

    const client = getPusherClient();
    const channel = client.subscribe(PRESENCE_CHANNEL) as PresenceChannel;

    const handleSubscriptionSucceeded = (members: Members) => {
      setPresence({
        authenticatedUserId,
        onlineUserIds: memberIds(members),
      });
    };
    const handleMemberAdded = (member: unknown) => {
      const id = memberId(member);
      if (!id) return;
      setPresence((current) => {
        const next = new Set(
          current?.authenticatedUserId === authenticatedUserId
            ? current.onlineUserIds
            : undefined
        );
        next.add(id);
        return { authenticatedUserId, onlineUserIds: next };
      });
    };
    const handleMemberRemoved = (member: unknown) => {
      const id = memberId(member);
      if (!id) return;
      setPresence((current) => {
        const next = new Set(
          current?.authenticatedUserId === authenticatedUserId
            ? current.onlineUserIds
            : undefined
        );
        next.delete(id);
        return { authenticatedUserId, onlineUserIds: next };
      });
    };
    const handleConnectionStateChange = (change: ConnectionStateChange) => {
      if (
        typeof change.current === 'string' &&
        STALE_CONNECTION_STATES.has(change.current)
      ) {
        setPresence(null);
      }
    };

    channel.bind('pusher:subscription_succeeded', handleSubscriptionSucceeded);
    channel.bind('pusher:member_added', handleMemberAdded);
    channel.bind('pusher:member_removed', handleMemberRemoved);
    client.connection.bind('state_change', handleConnectionStateChange);

    return () => {
      channel.unbind(
        'pusher:subscription_succeeded',
        handleSubscriptionSucceeded
      );
      channel.unbind('pusher:member_added', handleMemberAdded);
      channel.unbind('pusher:member_removed', handleMemberRemoved);
      client.connection.unbind('state_change', handleConnectionStateChange);
      client.unsubscribe(PRESENCE_CHANNEL);
      disconnectPusherClient(client);
    };
  }, [authenticatedUserId]);

  const isUserOnline = useCallback(
    (userId: string) =>
      Boolean(
        presence?.authenticatedUserId === authenticatedUserId &&
        presence.onlineUserIds.has(userId)
      ),
    [authenticatedUserId, presence]
  );

  const value = useMemo(() => ({ isUserOnline }), [isUserOnline]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}
