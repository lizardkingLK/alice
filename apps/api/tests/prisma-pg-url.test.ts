import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { connectionStringForPgAdapter } from '@repo/db';

const loadDb = createRequire(path.join(process.cwd(), 'package.json'));

describe('connectionStringForPgAdapter', () => {
  it('strips Prisma-only query params that pg ignores', () => {
    const input =
      'postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require';

    const result = connectionStringForPgAdapter(input);
    const url = new URL(result);

    expect(url.searchParams.has('pgbouncer')).toBe(false);
    expect(url.searchParams.has('connection_limit')).toBe(false);
    expect(url.searchParams.get('uselibpqcompat')).toBe('true');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.port).toBe('5432');
  });

  it('leaves a session-mode pooler URL on port 5432', () => {
    const input =
      'postgresql://user:pass@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';
    const url = new URL(connectionStringForPgAdapter(input));
    expect(url.port).toBe('5432');
    expect(url.searchParams.get('uselibpqcompat')).toBe('true');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });
});

describe('@repo/db CommonJS interop', () => {
  it('can be require()d like Vercel @vercel/node does', () => {
    const distEntry = path.resolve(
      process.cwd(),
      '../../packages/db/dist/index.js'
    );
    const db = loadDb(distEntry) as {
      getPrismaClient: unknown;
      connectionStringForPgAdapter: unknown;
    };
    expect(typeof db.getPrismaClient).toBe('function');
    expect(typeof db.connectionStringForPgAdapter).toBe('function');
  });
});
