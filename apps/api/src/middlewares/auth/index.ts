import { env } from '../../config/env';
import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import ws from 'ws';

export type AuthenticatedRequest = Request & {
  userId?: string;
};

/**
 * Stateless anon client reused across requests. `getUser(token)` validates the
 * passed JWT and does not rely on any stored session, so a single shared client
 * is safe and avoids re-instantiating one on every request.
 *
 * Node < 22 needs an explicit realtime WebSocket transport (`ws`).
 */
const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws as unknown as typeof WebSocket,
  },
});

/**
 * Verifies the Bearer access token and attaches `req.userId`.
 *
 * Intentionally does NOT touch `public.users`: profile provisioning happens at
 * the auth entry points (sign up, login, OAuth/email-confirm callback, and
 * admin invite), so this stays off the hot path — one Auth verify per request,
 * no DB round trip.
 */
export async function requireApiAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    console.error('API Auth Error:', error);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.userId = user.id;
  next();
}
