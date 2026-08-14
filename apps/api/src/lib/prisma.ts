import { getPrismaClient } from '@repo/db';
import { env } from '../config/env';

/** Singleton Prisma Client for API mutations (pooled `DATABASE_URL`). */
export const prisma = getPrismaClient(env.DATABASE_URL);
