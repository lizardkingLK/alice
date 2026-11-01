import type { Express } from 'express';
import { createUseServer } from '@repo/http-kit';
import { waitForPrisma } from '../lib/prisma';
import { env } from './env';

const useServer: (app: Express) => void = createUseServer({
  defaultPort: env.PORT,
  waitForPrisma,
  initErrorLabel: 'worker',
});

export default useServer;
