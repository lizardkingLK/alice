import express, { type RequestHandler } from 'express';
import type { RequestWithRawBody } from '../lib/raw-body';

/**
 * JSON body parser that also stashes the raw Buffer for HMAC verification
 * (GitHub webhooks need the exact bytes of `X-Hub-Signature-256`).
 */
const jsonConfig: RequestHandler = express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    (req as RequestWithRawBody).rawBody = buf;
  },
});

export default jsonConfig;
