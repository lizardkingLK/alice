import type { RequestHandler } from 'express';
import { createCorsConfig } from '@repo/http-kit';

const corsMiddleware: RequestHandler = createCorsConfig().corsMiddleware;

export default corsMiddleware;
