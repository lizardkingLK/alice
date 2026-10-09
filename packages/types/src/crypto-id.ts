/**
 * Secure id helpers via Web Crypto / Node global `crypto`.
 * Prefer this over `Math.random()` (flagged by sonarjs/pseudo-random).
 */

function getCrypto(): Crypto {
  const candidate = globalThis.crypto;
  if (!candidate) {
    throw new Error('Secure crypto is unavailable in this runtime');
  }
  return candidate;
}

/** RFC 4122 UUID v4 from `crypto.randomUUID` or `getRandomValues`. */
export function createRandomUUID(): string {
  const cryptoApi = getCrypto();
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure random UUID is unavailable in this runtime');
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  // Version 4 + RFC 4122 variant bits.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Prefixed entity id, e.g. `field-<uuid>`. */
export function createPrefixedId(prefix: string): string {
  return `${prefix}-${createRandomUUID()}`;
}
