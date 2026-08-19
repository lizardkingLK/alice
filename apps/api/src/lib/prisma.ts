import { getPrismaClient } from '@repo/db';
import { env } from '../config/env';

/** Singleton Prisma Client for API mutations (pooled `DATABASE_URL`). */
export const prisma = getPrismaClient(env.DATABASE_URL);

function logPrismaTarget(): void {
  try {
    const { hostname, port } = new URL(env.DATABASE_URL);
    console.log(`info. prisma target ${hostname}:${port || '5432'}`);
  } catch {
    console.error('error. prisma DATABASE_URL is not a valid URL');
  }
}

logPrismaTarget();

const PRISMA_READY_TIMEOUT_MS = 10_000;

/** Ping the database before accepting traffic so TLS/pooler failures show at boot. */
export async function waitForPrisma(): Promise<void> {
  try {
    await Promise.race([
      prisma.$connect().then(() => prisma.$queryRaw`SELECT 1`),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `prisma connect timed out after ${PRISMA_READY_TIMEOUT_MS}ms`
            )
          );
        }, PRISMA_READY_TIMEOUT_MS);
      }),
    ]);
    console.log('info. prisma connected');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('error. prisma connect failed:', message);
  }
}
