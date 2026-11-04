import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { dbPackageRoot } from './package-root.js';
import {
  decodeSecretEncryptionKey,
  decryptSecretWithKey,
  encryptSecretWithKey,
} from './secret-crypto.js';

export { isEncryptedSecret } from './secret-crypto.js';

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

  return decodeSecretEncryptionKey(raw);
}

export function encryptSecret(plaintext: string): string {
  return encryptSecretWithKey(resolveEncryptionKey(), plaintext);
}

export function decryptSecret(stored: string): string {
  return decryptSecretWithKey(resolveEncryptionKey(), stored);
}
