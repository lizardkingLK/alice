import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { dbPackageRoot } from './package-root.js';

const PREFIX = 'v1:';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Same wire format as `apps/api` `token-crypto` (`v1:` + AES-256-GCM).
 * Key: `INTEGRATION_TOKEN_ENCRYPTION_KEY` (base64 → 32 bytes).
 */
function loadEncryptionKeyFromEnvFiles(): string | undefined {
  if (process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) {
    return process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  }

  const packageRoot = dbPackageRoot();
  const candidates = [
    path.join(packageRoot, '.env'),
    path.join(packageRoot, '../../apps/api/.env'),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) {
      continue;
    }
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    const value = parsed.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveEncryptionKey(): Buffer {
  const raw = loadEncryptionKeyFromEnvFiles();
  if (!raw) {
    throw new Error(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY is required to seed encrypted chat agent instructions. Add it to packages/db/.env or apps/api/.env (32-byte base64 key).'
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

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt plaintext for at-rest storage (`v1:` + base64(iv|tag|ciphertext)). */
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

/** Decrypt stored secret; plaintext (non-`v1:`) returned as-is. */
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
