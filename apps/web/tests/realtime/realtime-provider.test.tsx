import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable no-unused-vars -- callback type params */
type EventHandler = (value: unknown) => void;
type MemberCallback = (member: { id: string }) => void;
/* eslint-enable no-unused-vars */

const mocks = vi.hoisted(() => {
  const channelHandlers = new Map<string, EventHandler>();
  const connectionHandlers = new Map<string, EventHandler>();
  const channel = {
    bind: vi.fn(),
    unbind: vi.fn(),
  };
  const connection = {
    bind: vi.fn(),
    unbind: vi.fn(),
  };

  channel.bind.mockImplementation((event: string, handler: EventHandler) => {
    channelHandlers.set(event, handler);
    return channel;
  });
  channel.unbind.mockImplementation((event: string, handler: EventHandler) => {
    if (channelHandlers.get(event) === handler) {
      channelHandlers.delete(event);
    }
    return channel;
  });
  connection.bind.mockImplementation((event: string, handler: EventHandler) => {
    connectionHandlers.set(event, handler);
    return connection;
  });
  connection.unbind.mockImplementation(
    (event: string, handler: EventHandler) => {
      if (connectionHandlers.get(event) === handler) {
        connectionHandlers.delete(event);
      }
      return connection;
    }
  );

  const client = {
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
    connection,
  };

  return {
    channel,
    channelHandlers,
    client,
    connection,
    connectionHandlers,
    disconnectPusherClient: vi.fn(),
    getPusherClient: vi.fn(() => client),
  };
});

vi.mock('@/lib/pusher/client', () => ({
  getPusherClient: mocks.getPusherClient,
  disconnectPusherClient: mocks.disconnectPusherClient,
}));

import {
  RealtimeProvider,
  useRealtime,
} from '@/components/realtime/realtime-provider';

const USER_ONE = '11111111-1111-4111-8111-111111111111';
const USER_TWO = '22222222-2222-4222-8222-222222222222';
const USER_THREE = '33333333-3333-4333-8333-333333333333';

function members(ids: string[]) {
  return {
    each(callback: MemberCallback) {
      ids.forEach((id) => callback({ id }));
    },
  };
}

function emitChannel(event: string, value: unknown) {
  act(() => {
    mocks.channelHandlers.get(event)?.(value);
  });
}

function emitConnectionState(current: string) {
  act(() => {
    mocks.connectionHandlers.get('state_change')?.({ current });
  });
}

function PresenceProbe() {
  const { isUserOnline } = useRealtime();
  return (
    <>
      <output data-testid="user-one">{String(isUserOnline(USER_ONE))}</output>
      <output data-testid="user-two">{String(isUserOnline(USER_TWO))}</output>
      <output data-testid="user-three">
        {String(isUserOnline(USER_THREE))}
      </output>
    </>
  );
}

function provider(userId: string | null) {
  return (
    <RealtimeProvider authenticatedUserId={userId}>
      <PresenceProbe />
    </RealtimeProvider>
  );
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.channelHandlers.clear();
    mocks.connectionHandlers.clear();
  });

  it('does not create or subscribe a Pusher client for anonymous users', () => {
    render(provider(null));

    expect(mocks.getPusherClient).not.toHaveBeenCalled();
    expect(mocks.client.subscribe).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-one')).toHaveTextContent('false');
  });

  it('subscribes once and updates online IDs from presence events', () => {
    render(provider(USER_ONE));

    expect(mocks.getPusherClient).toHaveBeenCalledTimes(1);
    expect(mocks.client.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.client.subscribe).toHaveBeenCalledWith('presence-workspace');

    emitChannel('pusher:subscription_succeeded', members([USER_ONE, USER_TWO]));
    expect(screen.getByTestId('user-one')).toHaveTextContent('true');
    expect(screen.getByTestId('user-two')).toHaveTextContent('true');
    expect(screen.getByTestId('user-three')).toHaveTextContent('false');

    emitChannel('pusher:member_added', { id: USER_THREE });
    expect(screen.getByTestId('user-three')).toHaveTextContent('true');

    emitChannel('pusher:member_removed', { id: USER_TWO });
    expect(screen.getByTestId('user-two')).toHaveTextContent('false');
  });

  it.each(['unavailable', 'failed', 'disconnected'])(
    'clears stale presence when the connection becomes %s',
    (connectionState) => {
      render(provider(USER_ONE));
      emitChannel('pusher:subscription_succeeded', members([USER_ONE]));
      expect(screen.getByTestId('user-one')).toHaveTextContent('true');

      emitConnectionState(connectionState);

      expect(screen.getByTestId('user-one')).toHaveTextContent('false');
    }
  );

  it('rebuilds the complete snapshot after reconnection succeeds', () => {
    render(provider(USER_ONE));
    emitChannel('pusher:subscription_succeeded', members([USER_ONE, USER_TWO]));
    emitConnectionState('unavailable');

    emitConnectionState('connected');
    emitChannel('pusher:subscription_succeeded', members([USER_THREE]));

    expect(screen.getByTestId('user-one')).toHaveTextContent('false');
    expect(screen.getByTestId('user-two')).toHaveTextContent('false');
    expect(screen.getByTestId('user-three')).toHaveTextContent('true');
  });

  it('does not reconnect for ordinary rerenders with the same user', () => {
    const { rerender } = render(provider(USER_ONE));

    rerender(provider(USER_ONE));

    expect(mocks.getPusherClient).toHaveBeenCalledTimes(1);
    expect(mocks.client.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectPusherClient).not.toHaveBeenCalled();
  });

  it('disconnects and clears presence when authentication is removed', () => {
    const { rerender } = render(provider(USER_ONE));
    emitChannel('pusher:subscription_succeeded', members([USER_ONE]));

    rerender(provider(null));

    expect(screen.getByTestId('user-one')).toHaveTextContent('false');
    expect(mocks.client.unsubscribe).toHaveBeenCalledWith('presence-workspace');
    expect(mocks.disconnectPusherClient).toHaveBeenCalledWith(mocks.client);
  });

  it('establishes presence after a later login', () => {
    const { rerender } = render(provider(null));

    rerender(provider(USER_ONE));

    expect(mocks.getPusherClient).toHaveBeenCalledTimes(1);
    expect(mocks.client.subscribe).toHaveBeenCalledWith('presence-workspace');
  });

  it('unbinds, unsubscribes, and disconnects during cleanup', () => {
    const { unmount } = render(provider(USER_ONE));

    unmount();

    expect(mocks.channel.unbind).toHaveBeenCalledWith(
      'pusher:subscription_succeeded',
      expect.any(Function)
    );
    expect(mocks.channel.unbind).toHaveBeenCalledWith(
      'pusher:member_added',
      expect.any(Function)
    );
    expect(mocks.channel.unbind).toHaveBeenCalledWith(
      'pusher:member_removed',
      expect.any(Function)
    );
    expect(mocks.connection.unbind).toHaveBeenCalledWith(
      'state_change',
      expect.any(Function)
    );
    expect(mocks.client.unsubscribe).toHaveBeenCalledWith('presence-workspace');
    expect(mocks.disconnectPusherClient).toHaveBeenCalledWith(mocks.client);
  });

  it('throws when useRealtime is used outside RealtimeProvider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<PresenceProbe />)).toThrow(
      'useRealtime must be used within RealtimeProvider'
    );
    consoleError.mockRestore();
  });
});
