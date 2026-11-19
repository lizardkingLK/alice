import type { ErrorRequestHandler } from 'express';
import { createErrorHandler } from '@repo/http-kit';

const errorConfig: ErrorRequestHandler = createErrorHandler({
  logLabel: 'api request failed',
});

export default errorConfig;
