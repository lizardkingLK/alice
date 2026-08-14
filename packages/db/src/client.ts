import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@repo/types/prisma';

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

export type { PrismaClient };

/**
 * Pooled runtime client for app queries (Vercel / Express).
 * Use `DIRECT_URL` only with Prisma CLI migrate — never here.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Process-wide singleton — reuse across serverless invocations in the same isolate. */
export function getPrismaClient(connectionString: string): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient(connectionString);
  }
  return globalForPrisma.prisma;
}
