import { performance } from 'node:perf_hooks';
import type { Pool, PoolClient, QueryResult } from 'pg';

const DEFAULT_ACQUISITION_TIMEOUT_MS = 2_000;
const DEFAULT_RETRY_INTERVAL_MS = 25;
const DEFAULT_UNLOCK_TIMEOUT_MS = 2_000;

const TRY_LOCK_SQL =
  'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired';
const UNLOCK_SQL =
  'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked';

export type PostgresAdvisoryLockConnectionMode =
  'direct' | 'session-pool' | 'transaction-pool' | 'unknown';

export type PostgresSessionAdvisoryLockOptions = {
  /**
   * Must describe how the supplied pool reaches PostgreSQL. Session advisory
   * locks are unsafe through transaction pooling and unknown proxies.
   */
  connectionMode: PostgresAdvisoryLockConnectionMode;
  acquisitionTimeoutMs?: number;
  retryIntervalMs?: number;
  unlockTimeoutMs?: number;
};

export type PostgresSessionAdvisoryLockOperation<T> = (
  signal: AbortSignal
) => Promise<T>;

export class PostgresAdvisoryLockTimeoutError extends Error {
  constructor() {
    super('Timed out while waiting for the PostgreSQL advisory lock.');
    this.name = 'PostgresAdvisoryLockTimeoutError';
  }
}

export class PostgresAdvisoryLockConnectionModeError extends Error {
  constructor(mode: PostgresAdvisoryLockConnectionMode) {
    super(
      `PostgreSQL ${mode} mode cannot safely provide a session advisory lock.`
    );
    this.name = 'PostgresAdvisoryLockConnectionModeError';
  }
}

export class PostgresAdvisoryLockConnectionLostError extends Error {
  constructor(cause: unknown) {
    super('The PostgreSQL session holding the advisory lock was lost.', {
      cause,
    });
    this.name = 'PostgresAdvisoryLockConnectionLostError';
  }
}

export class PostgresAdvisoryUnlockError extends Error {
  constructor(cause?: unknown) {
    super('The PostgreSQL advisory lock could not be confirmed as released.', {
      cause,
    });
    this.name = 'PostgresAdvisoryUnlockError';
  }
}

function explicitPoolMode(url: URL): PostgresAdvisoryLockConnectionMode | null {
  const poolMode = url.searchParams.get('pool_mode')?.toLowerCase();
  const pgbouncer = url.searchParams.get('pgbouncer')?.toLowerCase();
  if (
    poolMode === 'transaction' ||
    poolMode === 'statement' ||
    pgbouncer === 'true'
  ) {
    return 'transaction-pool';
  }
  return poolMode === 'session' ? 'session-pool' : null;
}

function supabaseConnectionMode(
  url: URL
): PostgresAdvisoryLockConnectionMode | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname.includes('pooler.supabase.com')) {
    if (url.port === '6543') return 'transaction-pool';
    return url.port === '5432' ? 'session-pool' : 'unknown';
  }
  if (hostname.startsWith('db.') && hostname.endsWith('.supabase.co')) {
    if (url.port === '6543') return 'transaction-pool';
    return url.port === '' || url.port === '5432' ? 'direct' : 'unknown';
  }
  return null;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

/**
 * Classify connection modes that can be identified from a PostgreSQL URL.
 *
 * Known direct PostgreSQL URLs and Supabase session pooling (shared-pooler port
 * 5432) keep one backend session for a checked-out client. Supabase transaction
 * pooling (port 6543), `pgbouncer=true`, and an explicit transaction/statement
 * pool mode are incompatible. An unmarked intermediary can look like a direct
 * URL, so unrecognized remote hosts are classified as `unknown`. Callers still
 * must verify their provider's mode; URL classification cannot prove session
 * affinity for an arbitrary proxy.
 */
export function postgresAdvisoryLockConnectionMode(
  connectionString: string
): PostgresAdvisoryLockConnectionMode {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return 'unknown';
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return 'unknown';
  }

  return (
    explicitPoolMode(url) ??
    supabaseConnectionMode(url) ??
    (isLoopbackHost(url.hostname.toLowerCase()) ? 'direct' : 'unknown')
  );
}

function requireCompatibleConnectionMode(
  mode: PostgresAdvisoryLockConnectionMode
): void {
  if (mode !== 'direct' && mode !== 'session-pool') {
    throw new PostgresAdvisoryLockConnectionModeError(mode);
  }
}

function positiveFiniteNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
  return value;
}

function firstBooleanRow(
  result: QueryResult<Record<string, unknown>>,
  property: 'acquired' | 'unlocked'
): boolean | null {
  const value = result.rows[0]?.[property];
  return typeof value === 'boolean' ? value : null;
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

type CheckedOutSession = {
  client: PoolClient;
  released: boolean;
};

function invokePromise<T>(operation: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(operation);
}

function endClientAfterReleaseFailure(client: PoolClient): void {
  const end = (client as unknown as { end?: () => Promise<void> }).end;
  if (!end) return;
  invokePromise(() => end.call(client)).catch(() => {
    // The release error remains the reported failure. This observer prevents
    // the best-effort forced close from creating an unhandled rejection.
  });
}

function releaseSession(session: CheckedOutSession, destroy: boolean): unknown {
  if (session.released) {
    return undefined;
  }
  session.released = true;
  try {
    session.client.release(destroy ? true : undefined);
    return undefined;
  } catch (error) {
    endClientAfterReleaseFailure(session.client);
    return error;
  }
}

function destroyLateClient(client: PoolClient): void {
  try {
    client.release(true);
  } catch {
    // The caller has already received a timeout. The late checkout promise is
    // still observed here so neither its resolution nor cleanup can become an
    // unhandled rejection. Direct close is the last safe cleanup attempt.
    endClientAfterReleaseFailure(client);
  }
}

function checkoutBeforeDeadline(
  pool: Pick<Pool, 'connect'>,
  deadline: number
): Promise<PoolClient> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutMs = Math.max(0, deadline - performance.now());
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new PostgresAdvisoryLockTimeoutError());
    }, timeoutMs);

    let pendingCheckout: Promise<PoolClient>;
    try {
      pendingCheckout = pool.connect();
    } catch (error) {
      settled = true;
      clearTimeout(timer);
      reject(error);
      return;
    }

    pendingCheckout
      .then(
        (client) => {
          if (settled || performance.now() >= deadline) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new PostgresAdvisoryLockTimeoutError());
            }
            destroyLateClient(client);
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(client);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      )
      .catch(() => {
        // Both handlers above are deliberately non-throwing. Keep this final
        // observer so a future change cannot create an unhandled rejection.
      });
  });
}

function promiseBeforeDeadline<T>(input: {
  deadline: number;
  onTimeout: () => unknown;
  operation: () => Promise<T>;
  timeoutError: () => Error;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishTimeout = () => {
      if (settled) return;
      settled = true;
      const cleanupError = input.onTimeout();
      reject(
        combinedFailure(
          input.timeoutError(),
          cleanupError === undefined ? [] : [cleanupError]
        )
      );
    };
    const timer = setTimeout(
      finishTimeout,
      Math.max(0, input.deadline - performance.now())
    );

    const pendingOperation = invokePromise(input.operation);

    pendingOperation
      .then(
        (value) => {
          if (settled) return;
          if (performance.now() >= input.deadline) {
            clearTimeout(timer);
            finishTimeout();
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      )
      .catch(() => {
        // Observe any error thrown by a settlement handler. Late operation
        // resolutions and rejections are otherwise intentionally ignored.
      });
  });
}

async function tryAcquireLock(
  session: CheckedOutSession,
  lockKey: string,
  deadline: number,
  retryIntervalMs: number,
  signal: AbortSignal
): Promise<void> {
  while (performance.now() < deadline) {
    const result = await promiseBeforeDeadline({
      deadline,
      onTimeout: () => releaseSession(session, true),
      operation: () =>
        session.client.query<Record<string, unknown>>(TRY_LOCK_SQL, [lockKey]),
      timeoutError: () => new PostgresAdvisoryLockTimeoutError(),
    });
    const acquired = firstBooleanRow(result, 'acquired');
    if (acquired === null) {
      throw new Error(
        'PostgreSQL returned an invalid advisory-lock acquisition result.'
      );
    }
    if (acquired) {
      return;
    }

    const remainingMs = deadline - performance.now();
    if (remainingMs <= 0) {
      throw new PostgresAdvisoryLockTimeoutError();
    }
    // Polling must remain sequential because every attempt uses the same session.
    await waitForRetry(Math.min(retryIntervalMs, remainingMs), signal); // NOSONAR
  }
  throw new PostgresAdvisoryLockTimeoutError();
}

function combinedFailure(
  primaryError: unknown,
  cleanupErrors: unknown[]
): unknown {
  const errors = [primaryError, ...cleanupErrors].filter(
    (error) => error !== undefined
  );
  if (errors.length === 0) {
    return undefined;
  }
  if (errors.length === 1) {
    return errors[0];
  }
  return new AggregateError(
    errors,
    'The advisory-lock operation and its cleanup did not both succeed.'
  );
}

async function cleanUpLockSession(input: {
  session: CheckedOutSession;
  destroyConnection: boolean;
  lockKey: string;
  lockMayBeHeld: boolean;
  onConnectionError: (error: Error) => void;
  shouldDestroyConnection: () => boolean;
  unlockTimeoutMs: number;
}): Promise<unknown[]> {
  const cleanupErrors: unknown[] = [];
  let destroyConnection = input.destroyConnection;

  if (input.lockMayBeHeld && !input.session.released) {
    try {
      const unlockDeadline = performance.now() + input.unlockTimeoutMs;
      const result = await promiseBeforeDeadline({
        deadline: unlockDeadline,
        onTimeout: () => releaseSession(input.session, true),
        operation: () =>
          input.session.client.query<Record<string, unknown>>(UNLOCK_SQL, [
            input.lockKey,
          ]),
        timeoutError: () =>
          new PostgresAdvisoryUnlockError(
            new Error('Timed out while releasing the PostgreSQL advisory lock.')
          ),
      });
      if (firstBooleanRow(result, 'unlocked') !== true) {
        throw new PostgresAdvisoryUnlockError();
      }
    } catch (error) {
      destroyConnection = true;
      cleanupErrors.push(
        error instanceof PostgresAdvisoryUnlockError
          ? error
          : new PostgresAdvisoryUnlockError(error)
      );
    }
  }

  destroyConnection ||= input.shouldDestroyConnection();
  input.session.client.off('error', input.onConnectionError);
  const releaseError = releaseSession(input.session, destroyConnection);
  if (releaseError !== undefined) {
    cleanupErrors.push(releaseError);
  }
  return cleanupErrors;
}

/**
 * Execute an operation while one checked-out PostgreSQL session owns a lock.
 *
 * The outer session lock is intended to be acquired before any inner
 * transaction locks. Callers must preserve this order:
 * OAuth app -> credential identity -> credential ID -> project binding.
 *
 * The callback receives an AbortSignal that fires if the database session
 * reports an error. Callbacks performing I/O must pass it to that I/O. An
 * abort cannot undo a request that an external server has already accepted.
 */
export async function withPostgresSessionAdvisoryLock<T>(
  pool: Pick<Pool, 'connect'>,
  lockKey: string,
  operation: PostgresSessionAdvisoryLockOperation<T>,
  options: PostgresSessionAdvisoryLockOptions
): Promise<T> {
  const acquisitionStartedAt = performance.now();
  requireCompatibleConnectionMode(options.connectionMode);
  if (!lockKey) {
    throw new TypeError('PostgreSQL advisory lock key must not be empty.');
  }
  const acquisitionTimeoutMs = positiveFiniteNumber(
    options.acquisitionTimeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS,
    'acquisitionTimeoutMs'
  );
  const retryIntervalMs = positiveFiniteNumber(
    options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS,
    'retryIntervalMs'
  );
  const unlockTimeoutMs = positiveFiniteNumber(
    options.unlockTimeoutMs ?? DEFAULT_UNLOCK_TIMEOUT_MS,
    'unlockTimeoutMs'
  );

  const acquisitionDeadline = acquisitionStartedAt + acquisitionTimeoutMs;
  const client = await checkoutBeforeDeadline(pool, acquisitionDeadline);
  const session: CheckedOutSession = { client, released: false };
  const abortController = new AbortController();
  let connectionError: Error | undefined;
  let lockMayBeHeld = false;
  let destroyConnection = false;
  let primaryError: unknown;
  let operationResult: T | undefined;
  let cleanupErrors: unknown[] = [];

  const onConnectionError = (error: Error) => {
    connectionError ??= error;
    destroyConnection = true;
    abortController.abort(error);
  };
  client.on('error', onConnectionError);

  try {
    try {
      await tryAcquireLock(
        session,
        lockKey,
        acquisitionDeadline,
        retryIntervalMs,
        abortController.signal
      );
    } catch (error) {
      destroyConnection = true;
      throw error;
    }

    lockMayBeHeld = true;
    if (performance.now() >= acquisitionDeadline) {
      throw new PostgresAdvisoryLockTimeoutError();
    }
    if (connectionError) {
      throw new PostgresAdvisoryLockConnectionLostError(connectionError);
    }

    try {
      operationResult = await operation(abortController.signal);
    } catch (error) {
      primaryError = error;
    }
    if (connectionError) {
      primaryError = new PostgresAdvisoryLockConnectionLostError(
        primaryError ?? connectionError
      );
    }
  } catch (error) {
    primaryError = error;
  } finally {
    cleanupErrors = await cleanUpLockSession({
      session,
      destroyConnection,
      lockKey,
      lockMayBeHeld,
      onConnectionError,
      shouldDestroyConnection: () => destroyConnection,
      unlockTimeoutMs,
    });
  }

  if (
    connectionError &&
    !(primaryError instanceof PostgresAdvisoryLockConnectionLostError)
  ) {
    primaryError = new PostgresAdvisoryLockConnectionLostError(
      primaryError ?? connectionError
    );
  }

  const failure = combinedFailure(primaryError, cleanupErrors);
  if (failure !== undefined) {
    throw failure;
  }
  return operationResult as T;
}
