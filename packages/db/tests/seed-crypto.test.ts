import { afterEach, describe, expect, it } from 'vitest';

const MOCK_KEY = Buffer.alloc(32, 7).toString('base64');

describe('seed-crypto', () => {
  afterEach(() => {
    delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  });

  it('round-trips plaintext through encryptSecret / decryptSecret', async () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = MOCK_KEY;
    const { encryptSecret, decryptSecret, isEncryptedSecret } =
      await import('../src/seed-crypto.js');

    const plaintext = 'You are Alice Assistant.';
    const stored = encryptSecret(plaintext);

    expect(isEncryptedSecret(stored)).toBe(true);
    expect(stored.startsWith('v1:')).toBe(true);
    expect(decryptSecret(stored)).toBe(plaintext);
  });
});
