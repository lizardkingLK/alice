import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { utcNow } from '@repo/types';
import { resolveIntegrationEncryptionKey } from './token-crypto';

export const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  userId: string;
  nonce: string;
  exp: number;
};

function resolveHmacKey(purpose: string): Buffer {
  return resolveIntegrationEncryptionKey(purpose);
}

function base64UrlEncode(value: string | Buffer): string {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buf.toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function signOAuthState(
  payload: OAuthStatePayload,
  purpose = 'sign OAuth state (HMAC)'
): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', resolveHmacKey(purpose))
    .update(body)
    .digest();
  return `${body}.${base64UrlEncode(sig)}`;
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
  const [body, sigPart] = state.split('.');
  if (!body || !sigPart) {
    throw new Error('Invalid OAuth state.');
  }

  const expected = createHmac('sha256', resolveHmacKey(purpose))
    .update(body)
    .digest();
  const actual = base64UrlDecode(sigPart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid OAuth state signature.');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(body).toString('utf8')
    ) as OAuthStatePayload;
  } catch {
    throw new Error('Invalid OAuth state payload.');
  }

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.nonce !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new TypeError('Invalid OAuth state payload.');
  }

  if (utcNow().getTime() > payload.exp) {
    throw new Error('OAuth state has expired. Please try connecting again.');
  }

  return payload;
}
