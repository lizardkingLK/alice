import type { Express } from 'express';

/** Harden default Express response headers. */
export default function securityConfig(app: Express): void {
  app.disable('x-powered-by');
}
