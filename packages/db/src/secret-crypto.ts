import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'v1:';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export const SECRET_CRYPTO_KEY_LENGTH = 32;

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt plaintext for at-rest storage (`v1:` + base64(iv|tag|ciphertext)). */
export function encryptSecretWithKey(key: Buffer, plaintext: string): string {
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

/** Decrypt stored secret; plaintext (non-`v1:`) returned as-is. */
export function decryptSecretWithKey(key: Buffer, stored: string): string {
  if (!isEncryptedSecret(stored)) {
    return stored;
  }

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

/** Decode a base64 AES-256-GCM key (exactly 32 raw bytes). */
export function decodeSecretEncryptionKey(
  raw: string,
  invalidMessage = 'INTEGRATION_TOKEN_ENCRYPTION_KEY must be valid base64 encoding a 32-byte key.'
): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(invalidMessage);
  }

  if (key.length !== SECRET_CRYPTO_KEY_LENGTH) {
    throw new Error(
      `INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to ${SECRET_CRYPTO_KEY_LENGTH} bytes (got ${key.length}).`
    );
  }

  return key;
}
