import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Verify GitHub `X-Hub-Signature-256` against the raw request body.
 * Uses timing-safe comparison; returns false for missing/malformed headers.
 */
export function verifyGithubWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!/^[0-9a-f]+$/i.test(receivedHex)) {
    return false;
  }

  const expectedHex = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(expectedHex, 'utf8');
  const received = Buffer.from(receivedHex.toLowerCase(), 'utf8');

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

/** Convenience for tests and diagnostics. */
export function signGithubWebhookBody(
  rawBody: Buffer | string,
  secret: string
): string {
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return `${SIGNATURE_PREFIX}${digest}`;
}
