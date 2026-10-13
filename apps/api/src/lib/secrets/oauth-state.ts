import { randomBytes } from 'node:crypto';
import { utcNow } from '@repo/types';
import { signJsonHmac, verifyJsonHmac } from './hmac-payload';

export const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
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
  return signOAuthState(
    {
      userId,
      nonce: randomBytes(16).toString('hex'),
      exp: utcNow().getTime() + ttlMs,
    },
    purpose
  );
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
    typeof (parsed as OAuthStatePayload).exp !== 'number'
  ) {
    throw new TypeError('Invalid OAuth state payload.');
  }

  const payload = parsed as OAuthStatePayload;

  if (utcNow().getTime() > payload.exp) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  return payload;
}
