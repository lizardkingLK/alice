import {
  decodeSecretEncryptionKey,
  decryptSecretWithKey,
  encryptSecretWithKey,
  isEncryptedSecret,
} from '@repo/db';
import { env } from '../../config/env';

export { isEncryptedSecret };

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

  return decodeSecretEncryptionKey(raw);
}

function resolveEncryptionKey(): Buffer {
  return resolveIntegrationEncryptionKey();
}

/** Encrypt a plaintext secret for at-rest storage (`v1:` + base64(iv|tag|ciphertext)). */
export function encryptSecret(plaintext: string): string {
  return encryptSecretWithKey(resolveEncryptionKey(), plaintext);
}

/**
 * Decrypt a stored secret. Plaintext (non-`v1:`) values are returned as-is for
 * lazy migration of rows written before encryption was enabled.
 */
export function decryptSecret(stored: string): string {
  return decryptSecretWithKey(resolveEncryptionKey(), stored);
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
