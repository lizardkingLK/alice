import { createAppPrisma } from '@repo/http-kit';
import { env } from '../config/env';

/** Singleton Prisma Client for API mutations (pooled `DATABASE_URL`). */
export const { prisma, waitForPrisma } = createAppPrisma({
  connectionString: env.DATABASE_URL,
});
