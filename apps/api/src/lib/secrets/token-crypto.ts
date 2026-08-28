import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

const PREFIX = 'v1:';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Decode `INTEGRATION_TOKEN_ENCRYPTION_KEY` (base64 → exactly 32 raw bytes).
 * Used for AES-256-GCM secrets and HMAC-signing Atlassian OAuth `state`.
 */
export function resolveIntegrationEncryptionKey(
  purpose = 'encrypt or decrypt integration secrets'
): Buffer {
  const raw = env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      `INTEGRATION_TOKEN_ENCRYPTION_KEY is required to ${purpose}.`
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY must be valid base64 encoding a 32-byte key.'
    );
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}).`
    );
  }

  return key;
}

function resolveEncryptionKey(): Buffer {
  return resolveIntegrationEncryptionKey();
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt a plaintext secret for at-rest storage (`v1:` + base64(iv|tag|ciphertext)). */
export function encryptSecret(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]);
  return `${PREFIX}${packed.toString('base64')}`;
}

/**
 * Decrypt a stored secret. Plaintext (non-`v1:`) values are returned as-is for
 * lazy migration of rows written before encryption was enabled.
 */
export function decryptSecret(stored: string): string {
  if (!isEncryptedSecret(stored)) {
    return stored;
  }

  const key = resolveEncryptionKey();
  const packed = Buffer.from(stored.slice(PREFIX.length), 'base64');
  if (packed.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted secret payload.');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptSecretIfPresent(
  value: string | null | undefined
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return value === '' ? '' : null;
  }
  if (isEncryptedSecret(value)) {
    return value;
  }
  return encryptSecret(value);
}

export function decryptSecretIfPresent(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  return decryptSecret(value);
}
