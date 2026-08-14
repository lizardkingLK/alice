import { Prisma } from '@repo/types/prisma';

/** True when Postgres rejected an INSERT/UPDATE as a unique-index conflict. */
export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
