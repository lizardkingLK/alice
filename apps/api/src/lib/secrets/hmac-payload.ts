import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolveIntegrationEncryptionKey } from './token-crypto';

function resolveHmacKey(purpose: string): Buffer {
  return resolveIntegrationEncryptionKey(purpose);
}

export function base64UrlEncode(value: string | Buffer): string {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buf.toString('base64url');
}

export function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/** Sign a JSON-serializable payload as `base64url(json).base64url(hmac)`. */
export function signJsonHmac(payload: unknown, purpose: string): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', resolveHmacKey(purpose))
    .update(body)
    .digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

export type VerifyJsonHmacMessages = {
  readonly format?: string;
  readonly signature?: string;
  readonly payload?: string;
};

/**
 * Verify HMAC and return the parsed JSON payload.
 * Does not validate payload shape or expiry — callers do that.
 */
export function verifyJsonHmac(
  token: string,
  purpose: string,
  messages: string | VerifyJsonHmacMessages = 'Invalid signed payload.'
): unknown {
  const formatMessage =
    typeof messages === 'string'
      ? messages
      : (messages.format ?? 'Invalid signed payload.');
  const signatureMessage =
    typeof messages === 'string'
      ? messages
      : (messages.signature ?? formatMessage);
  const payloadMessage =
    typeof messages === 'string'
      ? messages
      : (messages.payload ?? formatMessage);

  const [body, sigPart] = token.split('.');
  if (!body || !sigPart) {
    throw new Error(formatMessage);
  }

  const expected = createHmac('sha256', resolveHmacKey(purpose))
    .update(body)
    .digest();
  const actual = base64UrlDecode(sigPart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error(signatureMessage);
  }

  try {
    return JSON.parse(base64UrlDecode(body).toString('utf8')) as unknown;
  } catch {
    throw new Error(payloadMessage);
  }
}
