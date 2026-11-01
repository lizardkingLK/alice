import type { ErrorRequestHandler } from 'express';
import { createErrorHandler } from '@repo/http-kit';

const errorConfig: ErrorRequestHandler = createErrorHandler({
  logLabel: 'worker server request failed',
});

export default errorConfig;
