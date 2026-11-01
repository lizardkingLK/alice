import type { RequestHandler } from 'express';
import { createCorsConfig } from '@repo/http-kit';

const { isAllowedCorsOrigin, corsMiddleware } = createCorsConfig();

const corsConfig: RequestHandler = corsMiddleware;

export { isAllowedCorsOrigin };
export default corsConfig;
