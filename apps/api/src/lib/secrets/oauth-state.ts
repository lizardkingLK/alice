import { randomBytes } from 'node:crypto';
import { utcNow } from '@repo/types';
import { signJsonHmac, verifyJsonHmac } from './hmac-payload';

export const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
  projectId?: string;
};

export type CreateOAuthStateOptions = {
  ttlMs?: number;
  projectId?: string;
};

export function signOAuthState(
  payload: OAuthStatePayload,
  purpose = 'sign OAuth state (HMAC)'
): string {
  return signJsonHmac(payload, purpose);
}

export function createOAuthState(
  userId: string,
  purpose: string,
  ttlMs = DEFAULT_STATE_TTL_MS
): string {
  return createOAuthStateWithPayload(userId, purpose, { ttlMs }).state;
}

/** Create a state value while exposing its nonce for a server-side one-time record. */
export function createOAuthStateWithPayload(
  userId: string,
  purpose: string,
  options: CreateOAuthStateOptions = {}
): { state: string; payload: OAuthStatePayload } {
  const payload: OAuthStatePayload = {
    userId,
    nonce: randomBytes(16).toString('hex'),
    exp: utcNow().getTime() + (options.ttlMs ?? DEFAULT_STATE_TTL_MS),
    ...(options.projectId ? { projectId: options.projectId } : {}),
  };
  return { state: signOAuthState(payload, purpose), payload };
}

export function verifyOAuthState(
  state: string,
  purpose = 'verify OAuth state (HMAC)'
): OAuthStatePayload {
  const parsed = verifyJsonHmac(state, purpose, {
    format: 'Invalid OAuth state.',
    signature: 'Invalid OAuth state signature.',
    payload: 'Invalid OAuth state payload.',
  });

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as OAuthStatePayload).userId !== 'string' ||
    typeof (parsed as OAuthStatePayload).nonce !== 'string' ||
    typeof (parsed as OAuthStatePayload).exp !== 'number' ||
    ('projectId' in parsed &&
      typeof (parsed as OAuthStatePayload).projectId !== 'string')
  ) {
    throw new TypeError('Invalid OAuth state payload.');
  }

  const payload = parsed as OAuthStatePayload;

  if (utcNow().getTime() > payload.exp) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  return payload;
}
