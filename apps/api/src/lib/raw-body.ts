import type { Request } from 'express';

export type RequestWithRawBody = Request & {
  rawBody?: Buffer;
};

export function getRawBody(req: Request): Buffer | undefined {
  return (req as RequestWithRawBody).rawBody;
}
