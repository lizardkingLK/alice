import {
  DATABASE_BUSY_CODE,
  DATABASE_BUSY_HTTP_STATUS,
  DATABASE_BUSY_USER_MESSAGE,
} from '@repo/types';
import { Prisma } from '@repo/types/prisma';

export { isDatabaseBusyError } from '@repo/types';

/** True when Postgres rejected an INSERT/UPDATE as a unique-index conflict. */
export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** Map pool / transaction-start failures to a stable API payload (alice#562). */
export function databaseBusyJsonError(): {
  status: typeof DATABASE_BUSY_HTTP_STATUS;
  error: typeof DATABASE_BUSY_USER_MESSAGE;
  code: typeof DATABASE_BUSY_CODE;
} {
  return {
    status: DATABASE_BUSY_HTTP_STATUS,
    error: DATABASE_BUSY_USER_MESSAGE,
    code: DATABASE_BUSY_CODE,
  };
}
