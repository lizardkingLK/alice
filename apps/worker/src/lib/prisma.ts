import { createAppPrisma } from '@repo/http-kit';
import { env } from '../config/env';

export const { waitForPrisma } = createAppPrisma({
  connectionString: env.DATABASE_URL,
});
