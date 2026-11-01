import { getPrismaClient, type PrismaClient } from '@repo/db';

const PRISMA_READY_TIMEOUT_MS = 10_000;

export type AppPrismaOptions = {
  connectionString: string;
};

export type AppPrisma = {
  prisma: PrismaClient;
  waitForPrisma: () => Promise<void>;
};

/** Process singleton + boot-time connectivity check for Express apps. */
export function createAppPrisma(options: AppPrismaOptions): AppPrisma {
  const { connectionString } = options;
  const prisma = getPrismaClient(connectionString);

  function logPrismaTarget(): void {
    try {
      const { hostname, port } = new URL(connectionString);
      console.log(`info. prisma target ${hostname}:${port || '5432'}`);
    } catch {
      console.error('error. prisma DATABASE_URL is not a valid URL');
    }
  }

  logPrismaTarget();

  async function waitForPrisma(): Promise<void> {
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

  return { prisma, waitForPrisma };
}
