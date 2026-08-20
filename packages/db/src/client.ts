import dns from 'node:dns';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@repo/types/prisma';

dns.setDefaultResultOrder('ipv4first');

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

export type { PrismaClient };

/** Prisma query-engine URL flags — `pg` does not honor these. */
const PRISMA_URL_PARAMS_TO_STRIP = ['pgbouncer', 'connection_limit'] as const;

const PG_POOL_MAX = 10;
const PG_POOL_CONNECT_TIMEOUT_MS = 8_000;
const PG_POOL_IDLE_TIMEOUT_MS = 30_000;
const PG_POOL_QUERY_TIMEOUT_MS = 10_000;

const SUPAVISOR_TRANSACTION_PORT = '6543';
const SUPAVISOR_SESSION_PORT = '5432';

/**
 * Make `DATABASE_URL` safe for `@prisma/adapter-pg`:
 * strip Prisma-only params, force libpq-compat SSL (encrypt, don't verify-full),
 * and rewrite Supavisor **transaction** mode (`*.pooler.supabase.com:6543`) to
 * **session** mode (`:5432`).
 */
export function connectionStringForPgAdapter(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    for (const key of PRISMA_URL_PARAMS_TO_STRIP) {
      url.searchParams.delete(key);
    }
    if (
      url.hostname.includes('pooler.supabase.com') &&
      url.port === SUPAVISOR_TRANSACTION_PORT
    ) {
      url.port = SUPAVISOR_SESSION_PORT;
      console.warn(
        'warn. prisma rewrote Supavisor transaction port 6543 to session 5432'
      );
    }
    // Current `pg` aliases `sslmode=require` to verify-full unless libpq-compat
    // is on — that rejects Supavisor's (or a proxy's) certificate chain.
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslmode', 'require');
    return url.toString();
  } catch {
    return connectionString;
  }
}

function logPrismaPoolError(err: Error) {
  console.error('error. prisma pg pool:', err.message);
}

/**
 * Pooled runtime client for app queries (Vercel / Express).
 * Use `DIRECT_URL` only with Prisma CLI migrate — never here.
 *
 * `@prisma/adapter-pg` holds a real connection across `BEGIN`…`COMMIT`.
 * Point `DATABASE_URL` at Supavisor **session** mode (pooler host, port 5432),
 * not transaction mode (6543). `pg.Pool` defaults to an infinite connect wait;
 * we set a timeout so a bad URL fails the request instead of hanging the UI.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const pool = new Pool({
    connectionString: connectionStringForPgAdapter(connectionString),
    max: PG_POOL_MAX,
    connectionTimeoutMillis: PG_POOL_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: PG_POOL_IDLE_TIMEOUT_MS,
    query_timeout: PG_POOL_QUERY_TIMEOUT_MS,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  });
  pool.on('error', logPrismaPoolError);
  const adapter = new PrismaPg(pool, {
    onPoolError: logPrismaPoolError,
  });
  return new PrismaClient({ adapter });
}

/** Process-wide singleton — reuse across serverless invocations in the same isolate. */
export function getPrismaClient(connectionString: string): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaConnectionString === connectionString
  ) {
    return globalForPrisma.prisma;
  }
  globalForPrisma.prisma = createPrismaClient(connectionString);
  globalForPrisma.prismaConnectionString = connectionString;
  return globalForPrisma.prisma;
}
