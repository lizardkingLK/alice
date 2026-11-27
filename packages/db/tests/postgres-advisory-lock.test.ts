import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PostgresAdvisoryLockConnectionLostError,
  PostgresAdvisoryLockConnectionModeError,
  PostgresAdvisoryLockTimeoutError,
  PostgresAdvisoryUnlockError,
  postgresAdvisoryLockConnectionMode,
  withPostgresSessionAdvisoryLock,
} from '../src/postgres-advisory-lock';

class MockPoolClient extends EventEmitter {
  end = vi.fn().mockResolvedValue(undefined);
  query = vi.fn();
  release = vi.fn();
}

function mockPool(client: MockPoolClient) {
  return {
    connect: vi.fn().mockResolvedValue(client as unknown as PoolClient),
  } as unknown as Pick<Pool, 'connect'>;
}

function acquiredResult(value: boolean) {
  return { rows: [{ acquired: value }] };
}

function unlockedResult(value: boolean) {
  return { rows: [{ unlocked: value }] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function nextEventLoopTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const lockOptions = {
  connectionMode: 'direct' as const,
  acquisitionTimeoutMs: 50,
  retryIntervalMs: 1,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('withPostgresSessionAdvisoryLock', () => {
  it('acquires, executes, unlocks, and returns the connection to the pool', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    const pool = mockPool(client);
    const operation = vi.fn().mockResolvedValue('done');

    await expect(
      withPostgresSessionAdvisoryLock(
        pool,
        'oauth-app-lock',
        operation,
        lockOptions
      )
    ).resolves.toBe('done');

    expect(operation).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pg_try_advisory_lock'),
      ['oauth-app-lock']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('pg_advisory_unlock'),
      ['oauth-app-lock']
    );
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('times out under contention without executing the operation', async () => {
    const client = new MockPoolClient();
    client.query.mockResolvedValue(acquiredResult(false));
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'contended-lock',
        operation,
        {
          connectionMode: 'session-pool',
          acquisitionTimeoutMs: 5,
          retryIntervalMs: 1,
        }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);

    expect(operation).not.toHaveBeenCalled();
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('pg_advisory_unlock')
      )
    ).toBe(false);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('releases the lock when the protected operation fails', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    const operationError = new Error('upstream failed');

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'operation-failure',
        async () => {
          throw operationError;
        },
        lockOptions
      )
    ).rejects.toBe(operationError);

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('discards the connection when unlock cannot be confirmed', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(false));

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'unlock-failure',
        async () => 'done',
        lockOptions
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryUnlockError);

    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('aborts the operation and discards the client after connection loss', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    const operation = vi.fn(
      (signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        })
    );

    const result = withPostgresSessionAdvisoryLock(
      mockPool(client),
      'lost-connection',
      operation,
      lockOptions
    );
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
    client.emit('error', new Error('socket closed'));

    await expect(result).rejects.toBeInstanceOf(
      PostgresAdvisoryLockConnectionLostError
    );
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('uses one checked-out client for acquisition and release', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    const pool = mockPool(client);

    await withPostgresSessionAdvisoryLock(
      pool,
      'same-session',
      async () => undefined,
      lockOptions
    );

    expect(pool.connect).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('discards the client when acquisition has an ambiguous query failure', async () => {
    const client = new MockPoolClient();
    client.query.mockRejectedValueOnce(new Error('connection reset'));
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'acquisition-error',
        operation,
        lockOptions
      )
    ).rejects.toThrow('connection reset');

    expect(operation).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('does not execute after a delayed acquisition passes the deadline', async () => {
    const client = new MockPoolClient();
    client.query
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(acquiredResult(true)), 10);
          })
      )
      .mockResolvedValueOnce(unlockedResult(true));
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'late-acquisition',
        operation,
        {
          connectionMode: 'direct',
          acquisitionTimeoutMs: 5,
          retryIntervalMs: 1,
        }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);

    expect(operation).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('rejects transaction pooling before checking out a connection', async () => {
    const client = new MockPoolClient();
    const pool = mockPool(client);
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(pool, 'incompatible-mode', operation, {
        connectionMode: 'transaction-pool',
      })
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockConnectionModeError);

    expect(pool.connect).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects a classified Supabase dedicated transaction pool', async () => {
    const client = new MockPoolClient();
    const pool = mockPool(client);
    const connectionMode = postgresAdvisoryLockConnectionMode(
      'postgresql://postgres:pass@db.abcdefghijkl.supabase.co:6543/postgres'
    );

    await expect(
      withPostgresSessionAdvisoryLock(
        pool,
        'dedicated-transaction-pool',
        async () => undefined,
        { connectionMode }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockConnectionModeError);

    expect(connectionMode).toBe('transaction-pool');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('bounds a pool checkout that never resolves', async () => {
    const connect = vi.fn(() => new Promise<PoolClient>(() => undefined));
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        { connect } as unknown as Pick<Pool, 'connect'>,
        'checkout-never-resolves',
        operation,
        {
          connectionMode: 'direct',
          acquisitionTimeoutMs: 5,
          retryIntervalMs: 1,
        }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);

    expect(operation).not.toHaveBeenCalled();
  });

  it('destroys a client returned after the checkout deadline', async () => {
    const checkout = deferred<PoolClient>();
    const client = new MockPoolClient();
    const operation = vi.fn();
    const result = withPostgresSessionAdvisoryLock(
      {
        connect: vi.fn(() => checkout.promise),
      } as unknown as Pick<Pool, 'connect'>,
      'late-checkout',
      operation,
      {
        connectionMode: 'direct',
        acquisitionTimeoutMs: 5,
        retryIntervalMs: 1,
      }
    );

    await expect(result).rejects.toBeInstanceOf(
      PostgresAdvisoryLockTimeoutError
    );
    checkout.resolve(client as unknown as PoolClient);
    await nextEventLoopTurn();

    expect(operation).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('destroys the session when an acquisition query never resolves', async () => {
    const client = new MockPoolClient();
    client.query.mockImplementationOnce(() => new Promise(() => undefined));
    const operation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'query-never-resolves',
        operation,
        {
          connectionMode: 'direct',
          acquisitionTimeoutMs: 5,
          retryIntervalMs: 1,
        }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);

    expect(operation).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('destroys the session when the unlock query never resolves', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockImplementationOnce(() => new Promise(() => undefined));

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'unlock-never-resolves',
        async () => 'done',
        { ...lockOptions, unlockTimeoutMs: 5 }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryUnlockError);

    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('discards the client when the session is lost during unlock', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockImplementationOnce(async () => {
        client.emit('error', new Error('lost during unlock'));
        return unlockedResult(true);
      });

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'unlock-connection-loss',
        async () => 'done',
        lockOptions
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockConnectionLostError);

    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('rejects unknown mode before checking out a connection', async () => {
    const client = new MockPoolClient();
    const pool = mockPool(client);

    await expect(
      withPostgresSessionAdvisoryLock(
        pool,
        'unknown-mode',
        async () => undefined,
        { connectionMode: 'unknown' }
      )
    ).rejects.toBeInstanceOf(PostgresAdvisoryLockConnectionModeError);

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('bounds nested acquisition with a one-client pool', async () => {
    const client = new MockPoolClient();
    const waitingCheckout = deferred<PoolClient>();
    const connect = vi
      .fn()
      .mockResolvedValueOnce(client as unknown as PoolClient)
      .mockImplementationOnce(() => waitingCheckout.promise);
    const pool = { connect } as unknown as Pick<Pool, 'connect'>;
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    client.release.mockImplementation((destroy?: boolean) => {
      if (!destroy) {
        waitingCheckout.resolve(client as unknown as PoolClient);
      }
    });
    const nestedOperation = vi.fn();

    await expect(
      withPostgresSessionAdvisoryLock(
        pool,
        'outer-lock',
        async () => {
          await expect(
            withPostgresSessionAdvisoryLock(
              pool,
              'inner-lock',
              nestedOperation,
              {
                connectionMode: 'direct',
                acquisitionTimeoutMs: 5,
                retryIntervalMs: 1,
              }
            )
          ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);
          return 'outer-complete';
        },
        lockOptions
      )
    ).resolves.toBe('outer-complete');
    await nextEventLoopTurn();

    expect(nestedOperation).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenNthCalledWith(1, undefined);
    expect(client.release).toHaveBeenNthCalledWith(2, true);
  });

  it('supports repeated sequential acquisition without retaining the lock', async () => {
    const client = new MockPoolClient();
    const pool = mockPool(client);
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true))
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));

    await withPostgresSessionAdvisoryLock(
      pool,
      'repeated-lock',
      async () => 'first',
      lockOptions
    );
    await withPostgresSessionAdvisoryLock(
      pool,
      'repeated-lock',
      async () => 'second',
      lockOptions
    );

    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.release).toHaveBeenCalledTimes(2);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('preserves operation and cleanup failures together', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(false));
    const operationError = new Error('operation failed');

    let caught: unknown;
    try {
      await withPostgresSessionAdvisoryLock(
        mockPool(client),
        'combined-failure',
        async () => {
          throw operationError;
        },
        lockOptions
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    const errors = (caught as AggregateError).errors;
    expect(errors).toContain(operationError);
    expect(
      errors.some((error) => error instanceof PostgresAdvisoryUnlockError)
    ).toBe(true);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('removes listeners and clears deadline timers after success', async () => {
    vi.useFakeTimers();
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));

    const result = withPostgresSessionAdvisoryLock(
      mockPool(client),
      'resource-cleanup',
      async () => 'done',
      lockOptions
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe('done');
    expect(client.listenerCount('error')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports release failure and observes a late checkout rejection', async () => {
    const client = new MockPoolClient();
    client.query
      .mockResolvedValueOnce(acquiredResult(true))
      .mockResolvedValueOnce(unlockedResult(true));
    const releaseError = new Error('release failed');
    client.release.mockImplementation(() => {
      throw releaseError;
    });

    await expect(
      withPostgresSessionAdvisoryLock(
        mockPool(client),
        'release-failure',
        async () => 'done',
        lockOptions
      )
    ).rejects.toBe(releaseError);
    expect(client.end).toHaveBeenCalledOnce();

    const checkout = deferred<PoolClient>();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await expect(
        withPostgresSessionAdvisoryLock(
          {
            connect: vi.fn(() => checkout.promise),
          } as unknown as Pick<Pool, 'connect'>,
          'late-rejection',
          async () => undefined,
          {
            connectionMode: 'direct',
            acquisitionTimeoutMs: 5,
            retryIntervalMs: 1,
          }
        )
      ).rejects.toBeInstanceOf(PostgresAdvisoryLockTimeoutError);
      checkout.reject(new Error('late checkout rejection'));
      await nextEventLoopTurn();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});

describe('postgresAdvisoryLockConnectionMode', () => {
  it('recognizes direct PostgreSQL and Supabase session pooling', () => {
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://user:pass@localhost:5432/alice'
      )
    ).toBe('direct');
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://user:pass@aws-0.pooler.supabase.com:5432/alice'
      )
    ).toBe('session-pool');
  });

  it('recognizes transaction pooling and leaves unknown proxies untrusted', () => {
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://user:pass@aws-0.pooler.supabase.com:6543/alice'
      )
    ).toBe('transaction-pool');
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://postgres:pass@db.abcdefghijkl.supabase.co:6543/postgres'
      )
    ).toBe('transaction-pool');
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://user:pass@proxy.example.test/alice?pgbouncer=true'
      )
    ).toBe('transaction-pool');
    expect(
      postgresAdvisoryLockConnectionMode(
        'postgresql://user:pass@proxy.example.test:5432/alice'
      )
    ).toBe('unknown');
    expect(postgresAdvisoryLockConnectionMode('not-a-url')).toBe('unknown');
  });
});
