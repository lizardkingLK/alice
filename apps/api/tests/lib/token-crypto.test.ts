import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const MOCK_KEY = Buffer.alloc(32, 7).toString('base64');

describe('token-crypto', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY', MOCK_KEY);
    vi.stubEnv('GITHUB_ACTIONS', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const { encryptSecret, decryptSecret, isEncryptedSecret } =
      await import('../../src/lib/secrets/token-crypto.js');

    const plaintext = 'ghp_test_secret_token';
    const encrypted = encryptSecret(plaintext);

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('passes through legacy plaintext on decrypt for lazy migration', async () => {
    const { decryptSecret, isEncryptedSecret } =
      await import('../../src/lib/secrets/token-crypto.js');

    expect(isEncryptedSecret('ghp_legacy')).toBe(false);
    expect(decryptSecret('ghp_legacy')).toBe('ghp_legacy');
  });

  it('does not double-encrypt already encrypted values', async () => {
    const { encryptSecret, encryptSecretIfPresent, decryptSecret } =
      await import('../../src/lib/secrets/token-crypto.js');

    const once = encryptSecret('once');
    const twice = encryptSecretIfPresent(once);
    expect(twice).toBe(once);
    expect(decryptSecret(twice!)).toBe('once');
  });
});
